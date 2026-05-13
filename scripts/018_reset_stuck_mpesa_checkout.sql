-- Reset ONE hard-coded transaction (legacy scratch script).
-- For ngrok/orphan STK in general, use 023_reset_orphan_mpesa_checkouts.sql (preview + bulk or UUID filter).
--
-- Original use: STK callback never reached the app (e.g. MPESA_CALLBACK_URL / ngrok offline).
-- Safe to re-run: only updates matching rows.

INSERT INTO public.transaction_history (transaction_id, old_status, new_status, changed_by, reason)
SELECT
  'e6cd934c-fa2e-4338-b24d-a95b85dfff9c'::uuid,
  'payment_pending',
  'seller_approved',
  NULL,
  'Script 018: orphan STK reset (callback unreachable); resume pay flow.'
WHERE EXISTS (
  SELECT 1
  FROM public.transactions t
  WHERE t.id = 'e6cd934c-fa2e-4338-b24d-a95b85dfff9c'::uuid
    AND t.status = 'payment_pending'
    AND t.payment_confirmed_at IS NULL
);

UPDATE public.transactions
SET
  status = 'seller_approved',
  mpesa_ref = NULL,
  mpesa_phone = NULL,
  updated_at = now()
WHERE id = 'e6cd934c-fa2e-4338-b24d-a95b85dfff9c'::uuid
  AND status = 'payment_pending'
  AND payment_confirmed_at IS NULL;
