-- Reset transaction(s) stuck in payment_pending when STK callback never reached the app
-- (e.g. ngrok URL changed, tunnel offline, wrong MPESA_CALLBACK_URL).
--
-- Mirrors app logic: lib/mpesaPayment.js getResumeStatusBeforePaymentPending +
-- POST /api/transactions/[id]/abandon-checkout (resume to last old_status before payment_pending,
-- or seller_approved if unknown).
--
-- SAFETY (read before running):
--   • Only touches rows where payment_confirmed_at IS NULL (never treat as paid in DB).
--   • If the buyer actually completed M-Pesa but your app missed the callback, verify in
--     Safaricom portal / STK query BEFORE running this — otherwise you clear a valid checkout.
--   • Default stale window: updated_at older than 8 minutes (same idea as abandon-checkout API).
--     For local dev you may shorten to interval '1 minute' in the CTE below.
--
-- WORKFLOW:
--   1) Run the PREVIEW query below.
--   2) Edit optional filters in the CTE (specific UUIDs, stale interval).
--   3) Run the UPDATE section (INSERT history + UPDATE transactions).

-- ---------------------------------------------------------------------------
-- 1) PREVIEW — safe, read-only
-- ---------------------------------------------------------------------------
SELECT
  t.id,
  t.status,
  t.mpesa_ref,
  t.payment_confirmed_at,
  t.updated_at,
  CASE
    WHEN lh.old_status IN ('seller_approved', 'initiated') THEN lh.old_status
    ELSE 'seller_approved'
  END AS would_resume_to
FROM public.transactions t
LEFT JOIN LATERAL (
  SELECT h.old_status
  FROM public.transaction_history h
  WHERE h.transaction_id = t.id
    AND h.new_status = 'payment_pending'
  ORDER BY h.created_at DESC
  LIMIT 1
) lh ON true
WHERE t.status = 'payment_pending'
  AND t.payment_confirmed_at IS NULL
  AND t.mpesa_ref IS NOT NULL
  AND t.updated_at < now() - interval '8 minutes'
  -- Optional: only these transactions (uncomment and paste UUIDs):
  -- AND t.id = ANY (ARRAY[
  --   'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  --   'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
  -- ]::uuid[])
ORDER BY t.updated_at ASC;

-- ---------------------------------------------------------------------------
-- 2) APPLY — INSERT audit row + clear checkout (run after preview looks right)
-- ---------------------------------------------------------------------------
WITH candidates AS (
  SELECT
    t.id,
    CASE
      WHEN lh.old_status IN ('seller_approved', 'initiated') THEN lh.old_status
      ELSE 'seller_approved'
    END AS resume_status
  FROM public.transactions t
  LEFT JOIN LATERAL (
    SELECT h.old_status
    FROM public.transaction_history h
    WHERE h.transaction_id = t.id
      AND h.new_status = 'payment_pending'
    ORDER BY h.created_at DESC
    LIMIT 1
  ) lh ON true
  WHERE t.status = 'payment_pending'
    AND t.payment_confirmed_at IS NULL
    AND t.mpesa_ref IS NOT NULL
    AND t.updated_at < now() - interval '8 minutes'
    -- Optional: same filter as preview — limit to specific orphans:
    -- AND t.id = ANY (ARRAY[
    --   'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid
    -- ]::uuid[])
),
ins AS (
  INSERT INTO public.transaction_history (transaction_id, old_status, new_status, changed_by, reason)
  SELECT
    c.id,
    'payment_pending',
    c.resume_status,
    NULL,
    'Script 023: orphan STK reset (callback/ngrok unreachable); resume pay flow.'
  FROM candidates c
  RETURNING transaction_id
)
UPDATE public.transactions t
SET
  status = c.resume_status,
  mpesa_ref = NULL,
  mpesa_phone = NULL,
  updated_at = now()
FROM candidates c
WHERE t.id = c.id;
