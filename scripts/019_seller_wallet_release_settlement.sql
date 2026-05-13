-- Seller wallet: ledger + idempotent settlement when a transaction becomes `released`.
-- Works for buyer confirm-delivery, pg_cron auto_release_funds(), admin resolve, etc.
--
-- Run this in the Supabase SQL editor for the Safe Hands project (after prior migrations).
-- Requires: transactions, users (account_balance, total_transactions_completed), extensions pgcrypto or uuid-ossp.

-- ---------------------------------------------------------------------------
-- 1) Ledger table (seller credits; future debits e.g. withdrawals)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions (id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit_sale_release', 'debit_withdrawal', 'adjustment')),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'KES',
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_created
  ON public.wallet_ledger_entries (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_one_release_credit_per_txn
  ON public.wallet_ledger_entries (transaction_id)
  WHERE entry_type = 'credit_sale_release';

COMMENT ON TABLE public.wallet_ledger_entries IS 'Append-only seller wallet lines; credits tied to released escrow sales.';

-- ---------------------------------------------------------------------------
-- 2) Idempotency marker (one settlement per transaction)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transaction_release_settlements (
  transaction_id UUID PRIMARY KEY REFERENCES public.transactions (id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  amount NUMERIC(15, 2) NOT NULL,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.transaction_release_settlements IS 'Exactly one row per transaction once release settlement has run (wallet + counters).';

-- ---------------------------------------------------------------------------
-- 3) Trigger: on transition to released, credit seller and bump completion counts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_settle_transaction_on_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_rows INTEGER;
  cur_currency TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'released' OR OLD.status = 'released' THEN
    RETURN NEW;
  END IF;

  IF NEW.seller_id IS NULL OR NEW.buyer_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.transaction_release_settlements (transaction_id, seller_id, buyer_id, amount)
  VALUES (NEW.id, NEW.seller_id, NEW.buyer_id, NEW.amount)
  ON CONFLICT (transaction_id) DO NOTHING;

  GET DIAGNOSTICS inserted_rows = ROW_COUNT;
  IF inserted_rows = 0 THEN
    RETURN NEW;
  END IF;

  cur_currency := COALESCE(NULLIF(btrim(COALESCE(NEW.currency, '')), ''), 'KES');

  INSERT INTO public.wallet_ledger_entries (
    user_id,
    transaction_id,
    entry_type,
    amount,
    currency,
    description,
    metadata
  )
  VALUES (
    NEW.seller_id,
    NEW.id,
    'credit_sale_release',
    NEW.amount,
    cur_currency,
    format('Sale proceeds from escrow (transaction %s)', substr(NEW.id::text, 1, 8)),
    jsonb_build_object('prior_status', OLD.status, 'buyer_id', NEW.buyer_id)
  );

  UPDATE public.users
  SET account_balance = COALESCE(account_balance, 0) + NEW.amount
  WHERE id = NEW.seller_id;

  UPDATE public.users
  SET total_transactions_completed = COALESCE(total_transactions_completed, 0) + 1
  WHERE id IN (NEW.seller_id, NEW.buyer_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_transactions_released_settlement ON public.transactions;

CREATE TRIGGER tr_transactions_released_settlement
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.fn_settle_transaction_on_release();

COMMENT ON FUNCTION public.fn_settle_transaction_on_release IS 'Credits seller wallet and increments buyer/seller completed counts once per released transaction.';

GRANT SELECT ON public.wallet_ledger_entries TO authenticated;
GRANT SELECT ON public.wallet_ledger_entries TO service_role;

-- ---------------------------------------------------------------------------
-- 5) RLS: sellers read their own ledger rows (API may use service role)
-- ---------------------------------------------------------------------------
ALTER TABLE public.wallet_ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_ledger_select_own ON public.wallet_ledger_entries;

CREATE POLICY wallet_ledger_select_own
  ON public.wallet_ledger_entries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6) Backfill: released transactions that never ran settlement (pre-trigger data)
--    Credits wallet + ledger + settlement marker only — does NOT change total_transactions_completed
--    (those rows may already have been adjusted by the app).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  cur_currency TEXT;
BEGIN
  FOR r IN
    SELECT t.id, t.seller_id, t.buyer_id, t.amount, t.currency
    FROM public.transactions t
    WHERE t.status = 'released'
      AND NOT EXISTS (
        SELECT 1 FROM public.transaction_release_settlements s WHERE s.transaction_id = t.id
      )
  LOOP
    INSERT INTO public.transaction_release_settlements (transaction_id, seller_id, buyer_id, amount)
    VALUES (r.id, r.seller_id, r.buyer_id, r.amount);

    cur_currency := COALESCE(NULLIF(btrim(COALESCE(r.currency, '')), ''), 'KES');

    INSERT INTO public.wallet_ledger_entries (
      user_id,
      transaction_id,
      entry_type,
      amount,
      currency,
      description,
      metadata
    )
    VALUES (
      r.seller_id,
      r.id,
      'credit_sale_release',
      r.amount,
      cur_currency,
      format('Backfill: sale proceeds (transaction %s)', substr(r.id::text, 1, 8)),
      jsonb_build_object('source', 'migration_019_backfill')
    );

    UPDATE public.users
    SET account_balance = COALESCE(account_balance, 0) + r.amount
    WHERE id = r.seller_id;
  END LOOP;
END $$;
