-- Atomic dispute creation + admin screening column
-- Run in Supabase SQL editor (or via migrate) after prior scripts.

ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS submission_screening text NOT NULL DEFAULT 'cleared'
  CHECK (submission_screening IN ('cleared', 'held'));

COMMENT ON COLUMN disputes.submission_screening IS
  'cleared: show in default admin queue; held: triage / hidden from default queue until reviewed';

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
