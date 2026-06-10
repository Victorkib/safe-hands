-- Post-verdict appeals (one per user per dispute, 7-day window by default).
-- Run after 027_dispute_response_window.sql

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
      'pending',
      'in_review',
      'upheld',
      'denied',
      'overturned',
      'manual_required'
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
CREATE INDEX IF NOT EXISTS idx_dispute_appeals_transaction ON public.dispute_appeals (transaction_id);

ALTER TABLE public.dispute_appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dispute_appeals_select_own ON public.dispute_appeals;
CREATE POLICY dispute_appeals_select_own
  ON public.dispute_appeals
  FOR SELECT
  TO authenticated
  USING (
    filed_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.id = dispute_id
        AND (d.raised_by = auth.uid() OR d.raised_against = auth.uid())
    )
  );

GRANT SELECT ON public.dispute_appeals TO authenticated;
GRANT ALL ON public.dispute_appeals TO service_role;

COMMENT ON TABLE public.dispute_appeals IS
  'Post-verdict review requests; does not replace the original dispute row.';
