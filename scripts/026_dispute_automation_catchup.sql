-- Dispute automation catch-up (idempotent)
-- Run in Supabase SQL Editor if you skipped 017 / 024 / 025 or admin suggestions / refunds fail.
--
-- Covers:
--   • disputes.submission_screening (017)
--   • disputes.dispute_queue, recommended_resolution, recommended_reason (024)
--   • refund_requests table + RLS (025)
--   • create_dispute_atomic RPC (017)
--   • Backfill routing suggestions on open disputes missing recommendations
--
-- Safe to run multiple times. Aligns with lib/disputeRouting.js (priority threshold default 50000 KES).

-- ─── 1) submission_screening (017) ───────────────────────────────────────────
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS submission_screening text NOT NULL DEFAULT 'cleared';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'disputes_submission_screening_check'
  ) THEN
    ALTER TABLE public.disputes
      ADD CONSTRAINT disputes_submission_screening_check
      CHECK (submission_screening IN ('cleared', 'held'));
  END IF;
END $$;

COMMENT ON COLUMN public.disputes.submission_screening IS
  'cleared: default admin queue; held: triage until reviewed';

-- ─── 2) Routing columns (024) ────────────────────────────────────────────────
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS dispute_queue text NOT NULL DEFAULT 'standard';

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS recommended_resolution text;

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS recommended_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'disputes_dispute_queue_check'
  ) THEN
    ALTER TABLE public.disputes
      ADD CONSTRAINT disputes_dispute_queue_check
      CHECK (dispute_queue IN ('standard', 'priority', 'triage', 'auto_suggest'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'disputes_recommended_resolution_check'
  ) THEN
    ALTER TABLE public.disputes
      ADD CONSTRAINT disputes_recommended_resolution_check
      CHECK (
        recommended_resolution IS NULL
        OR recommended_resolution IN ('refund_buyer', 'release_to_seller', 'partial_refund', 'cancelled')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_disputes_queue_status
  ON public.disputes (dispute_queue, status);

COMMENT ON COLUMN public.disputes.dispute_queue IS 'Admin routing: standard, priority, triage, auto_suggest';
COMMENT ON COLUMN public.disputes.recommended_resolution IS 'Informational suggestion until admin confirms';
COMMENT ON COLUMN public.disputes.recommended_reason IS 'Human-readable rationale for suggested resolution';

-- ─── 3) refund_requests (025) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.disputes (id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.transactions (id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  phone VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  ),
  simulated BOOLEAN NOT NULL DEFAULT false,
  mpesa_transaction_id TEXT,
  result_desc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_dispute ON public.refund_requests (dispute_id);
CREATE INDEX IF NOT EXISTS idx_refund_transaction ON public.refund_requests (transaction_id);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refund_select_own ON public.refund_requests;
CREATE POLICY refund_select_own
  ON public.refund_requests
  FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid());

GRANT SELECT ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;

COMMENT ON TABLE public.refund_requests IS
  'M-Pesa B2C refunds after dispute resolution; REFUND_DEMO_MODE completes instantly for demos.';

-- ─── 4) create_dispute_atomic (017) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_dispute_atomic(
  p_transaction_id uuid,
  p_raised_by uuid,
  p_raised_against uuid,
  p_reason text,
  p_description text,
  p_evidence_urls text[],
  p_dispute_evidence_notes text,
  p_submission_type text,
  p_old_tx_status text,
  p_screening text DEFAULT 'cleared'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_screening IS NULL OR p_screening NOT IN ('cleared', 'held') THEN
    RAISE EXCEPTION 'invalid submission_screening';
  END IF;

  IF EXISTS (SELECT 1 FROM public.disputes d WHERE d.transaction_id = p_transaction_id) THEN
    RAISE EXCEPTION 'dispute already exists for transaction';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = p_transaction_id
      AND t.status IN ('escrow', 'delivered')
      AND (
        (t.buyer_id = p_raised_by AND t.seller_id = p_raised_against)
        OR (t.seller_id = p_raised_by AND t.buyer_id = p_raised_against)
      )
  ) THEN
    RAISE EXCEPTION 'invalid transaction, parties, or status for dispute';
  END IF;

  INSERT INTO public.disputes (
    transaction_id,
    raised_by,
    raised_against,
    reason,
    description,
    evidence_urls,
    status,
    submission_screening
  )
  VALUES (
    p_transaction_id,
    p_raised_by,
    p_raised_against,
    p_reason,
    p_description,
    p_evidence_urls,
    'open',
    p_screening
  )
  RETURNING id INTO v_id;

  INSERT INTO public.delivery_evidence (
    transaction_id,
    submitted_by,
    submission_type,
    notes,
    photos
  )
  VALUES (
    p_transaction_id,
    p_raised_by,
    p_submission_type,
    p_dispute_evidence_notes,
    p_evidence_urls
  );

  UPDATE public.transactions
  SET is_disputed = true,
      status = 'disputed',
      updated_at = now()
  WHERE id = p_transaction_id;

  INSERT INTO public.transaction_history (
    transaction_id,
    old_status,
    new_status,
    changed_by,
    reason
  )
  VALUES (
    p_transaction_id,
    p_old_tx_status,
    'disputed',
    p_raised_by,
    format('Dispute raised: %s', p_reason)
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_dispute_atomic(
  uuid, uuid, uuid, text, text, text[], text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_dispute_atomic(
  uuid, uuid, uuid, text, text, text[], text, text, text, text
) TO service_role;

-- ─── 5) Backfill routing on open disputes (mirrors lib/disputeRouting.js) ─────
-- Priority threshold: 50000 KES (set DISPUTE_PRIORITY_AMOUNT_KES in app env to match).
WITH enriched AS (
  SELECT
    d.id,
    COALESCE(d.submission_screening, 'cleared') AS screening,
    d.reason,
    COALESCE(t.amount, 0)::numeric AS amount,
    COALESCE(array_length(d.evidence_urls, 1), 0) AS evidence_count,
    EXISTS (
      SELECT 1 FROM public.delivery_evidence de
      WHERE de.transaction_id = d.transaction_id
        AND de.submission_type = 'seller_ship'
    ) AS has_seller_ship,
    EXISTS (
      SELECT 1 FROM public.delivery_evidence de
      WHERE de.transaction_id = d.transaction_id
        AND de.submission_type = 'buyer_receive'
    ) AS has_buyer_receive
  FROM public.disputes d
  JOIN public.transactions t ON t.id = d.transaction_id
  WHERE d.status IN ('open', 'in_review', 'awaiting_response')
    AND (
      d.recommended_resolution IS NULL
      OR d.dispute_queue IS NULL
      OR d.dispute_queue = 'standard'
    )
),
step1 AS (
  SELECT
    e.*,
    CASE WHEN e.screening = 'held' THEN 'triage' ELSE 'standard' END AS queue_after_screening
  FROM enriched e
),
step2 AS (
  SELECT
    s.*,
    CASE
      WHEN s.reason IN ('payment_issue', 'other') THEN 'priority'
      WHEN s.amount >= 50000 AND s.queue_after_screening = 'triage' THEN 'triage'
      WHEN s.amount >= 50000 THEN 'priority'
      ELSE s.queue_after_screening
    END AS queue_after_amount,
    CASE
      WHEN s.reason IN ('payment_issue', 'other') THEN
        'Ambiguous reason category — admin review required.'
      WHEN s.amount >= 50000 AND s.reason NOT IN ('payment_issue', 'other') THEN
        format('Amount KES %s exceeds priority threshold.', to_char(s.amount, 'FM999,999,999'))
      ELSE NULL
    END AS reason_after_amount
  FROM step1 s
),
final AS (
  SELECT
    s.id,
    CASE
      WHEN s.reason = 'item_not_received' AND NOT s.has_seller_ship THEN
        CASE WHEN s.queue_after_amount = 'priority' THEN 'priority' ELSE 'auto_suggest' END
      WHEN s.reason = 'item_not_as_described'
        AND s.has_seller_ship
        AND s.has_buyer_receive
        AND s.evidence_count >= 2 THEN
        CASE WHEN s.queue_after_amount = 'triage' THEN 'triage' ELSE 'auto_suggest' END
      ELSE s.queue_after_amount
    END AS dispute_queue,
    CASE
      WHEN s.reason = 'item_not_received' AND NOT s.has_seller_ship THEN 'refund_buyer'
      WHEN s.reason = 'item_not_as_described'
        AND s.has_seller_ship
        AND s.has_buyer_receive
        AND s.evidence_count >= 2 THEN 'release_to_seller'
      ELSE NULL
    END AS recommended_resolution,
    CASE
      WHEN s.reason = 'item_not_received' AND NOT s.has_seller_ship THEN
        'No seller dispatch evidence on file — objective signal favours buyer not-received claim.'
      WHEN s.reason = 'item_not_as_described'
        AND s.has_seller_ship
        AND s.has_buyer_receive
        AND s.evidence_count >= 2 THEN
        'Seller shipped and buyer confirmed delivery with photos — lean toward seller unless description mismatch is clear.'
      ELSE s.reason_after_amount
    END AS recommended_reason
  FROM step2 s
)
UPDATE public.disputes d
SET
  dispute_queue = f.dispute_queue,
  recommended_resolution = COALESCE(f.recommended_resolution, d.recommended_resolution),
  recommended_reason = COALESCE(f.recommended_reason, d.recommended_reason),
  updated_at = now()
FROM final f
WHERE d.id = f.id
  AND (
    d.dispute_queue IS DISTINCT FROM f.dispute_queue
    OR d.recommended_resolution IS DISTINCT FROM COALESCE(f.recommended_resolution, d.recommended_resolution)
    OR d.recommended_reason IS DISTINCT FROM COALESCE(f.recommended_reason, d.recommended_reason)
  );

-- ─── 6) Verification (read-only) ─────────────────────────────────────────────
SELECT 'disputes.submission_screening' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'disputes' AND column_name = 'submission_screening'
       ) AS ok;

SELECT 'disputes.dispute_queue' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'disputes' AND column_name = 'dispute_queue'
       ) AS ok;

SELECT 'refund_requests table' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'refund_requests'
       ) AS ok;

SELECT 'open_disputes_with_suggestion' AS metric,
       count(*) FILTER (WHERE recommended_resolution IS NOT NULL) AS with_suggestion,
       count(*) AS total_open
FROM public.disputes
WHERE status IN ('open', 'in_review', 'awaiting_response');

-- ─── 7) Response window (027) ─────────────────────────────────────────────────
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS response_due_at TIMESTAMPTZ;

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS accused_responded_at TIMESTAMPTZ;

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS accused_response_text TEXT;

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS no_response_ruling BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_disputes_awaiting_response
  ON public.disputes (status, response_due_at)
  WHERE status IN ('awaiting_response', 'in_review', 'open');

UPDATE public.disputes d
SET
  response_due_at = COALESCE(d.response_due_at, d.created_at + INTERVAL '72 hours'),
  status = CASE
    WHEN d.status = 'open'
      AND d.accused_responded_at IS NULL
      AND d.resolved_at IS NULL
    THEN 'awaiting_response'
    ELSE d.status
  END,
  updated_at = now()
WHERE d.status IN ('open', 'awaiting_response', 'in_review')
  AND d.resolved_at IS NULL
  AND d.response_due_at IS NULL;

SELECT 'disputes.response_due_at' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'disputes' AND column_name = 'response_due_at'
       ) AS ok;

-- ─── 8) Post-verdict appeals (028) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dispute_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.disputes (id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.transactions (id) ON DELETE CASCADE,
  filed_by UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  appellant_role TEXT NOT NULL CHECK (appellant_role IN ('buyer', 'seller')),
  grounds TEXT NOT NULL CHECK (
    grounds IN ('new_evidence', 'procedural_error', 'factual_error')
  ),
  description TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending', 'in_review', 'upheld', 'denied', 'overturned', 'manual_required'
    )
  ),
  original_resolution TEXT NOT NULL,
  overturn_resolution TEXT CHECK (
    overturn_resolution IS NULL
    OR overturn_resolution IN ('refund_buyer', 'release_to_seller', 'partial_refund', 'cancelled')
  ),
  reversal_mode TEXT CHECK (
    reversal_mode IS NULL
    OR reversal_mode IN ('not_applicable', 'auto_applied', 'manual_required')
  ),
  reversal_notes TEXT,
  admin_notes TEXT,
  decided_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  appeal_deadline_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dispute_appeals_one_per_user UNIQUE (dispute_id, filed_by)
);

CREATE INDEX IF NOT EXISTS idx_dispute_appeals_dispute ON public.dispute_appeals (dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_appeals_status ON public.dispute_appeals (status, created_at DESC);

ALTER TABLE public.dispute_appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dispute_appeals_select_own ON public.dispute_appeals;
CREATE POLICY dispute_appeals_select_own
  ON public.dispute_appeals FOR SELECT TO authenticated
  USING (
    filed_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.id = dispute_id AND (d.raised_by = auth.uid() OR d.raised_against = auth.uid())
    )
  );

GRANT SELECT ON public.dispute_appeals TO authenticated;
GRANT ALL ON public.dispute_appeals TO service_role;

SELECT 'dispute_appeals table' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'dispute_appeals'
       ) AS ok;
