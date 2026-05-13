-- Seller withdrawals (M-Pesa B2C) + ledger link
-- Run in Supabase SQL editor after 019_seller_wallet_release_settlement.sql

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  phone VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  ),
  originator_conversation_id TEXT NOT NULL UNIQUE,
  conversation_id TEXT,
  result_code TEXT,
  result_desc TEXT,
  mpesa_transaction_id TEXT,
  simulated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_seller_created
  ON public.withdrawal_requests (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawal_status
  ON public.withdrawal_requests (status);

COMMENT ON TABLE public.withdrawal_requests IS 'Seller payout requests; B2C result debits wallet via app callback.';

ALTER TABLE public.wallet_ledger_entries
  ADD COLUMN IF NOT EXISTS withdrawal_request_id UUID REFERENCES public.withdrawal_requests (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_one_debit_per_withdrawal
  ON public.wallet_ledger_entries (withdrawal_request_id)
  WHERE entry_type = 'debit_withdrawal' AND withdrawal_request_id IS NOT NULL;

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS withdrawal_select_own ON public.withdrawal_requests;

CREATE POLICY withdrawal_select_own
  ON public.withdrawal_requests
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

GRANT SELECT ON public.withdrawal_requests TO authenticated;
GRANT SELECT ON public.withdrawal_requests TO service_role;

-- After running 019, if wallet_ledger_entries lacks withdrawal_request_id, this script adds it.

