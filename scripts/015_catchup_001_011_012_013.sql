-- Catch-up migration for environments where 001 was already applied
-- and later script execution order/history is uncertain.
--
-- Covers structural updates introduced by:
-- - 011_payment_pending_and_mpesa_receipt.sql
-- - 012_add_seller_approval_flow.sql
-- - 013_add_seller_invitations.sql
--
-- This script is intentionally idempotent and safe to run multiple times.

-- 1) Ensure final transactions status check (includes seller-approval + payment_pending states)
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_status_check CHECK (
    status IN (
      'initiated',
      'pending_seller_approval',
      'seller_approved',
      'seller_rejected',
      'seller_change_requested',
      'payment_pending',
      'escrow',
      'delivered',
      'released',
      'disputed',
      'refunded',
      'cancelled'
    )
  );

-- 2) Ensure payment receipt column/index
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS mpesa_receipt_number VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_transactions_mpesa_receipt_number
  ON transactions(mpesa_receipt_number);

-- 3) Ensure seller approval request table/indexes/trigger
CREATE TABLE IF NOT EXISTS seller_transaction_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE UNIQUE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(40) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'change_requested')
  ),
  seller_message TEXT,
  proposed_amount DECIMAL(15, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seller_tx_requests_seller
  ON seller_transaction_requests(seller_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_tx_requests_buyer
  ON seller_transaction_requests(buyer_id, created_at DESC);

DROP TRIGGER IF EXISTS seller_transaction_requests_updated_at ON seller_transaction_requests;
CREATE TRIGGER seller_transaction_requests_updated_at
BEFORE UPDATE ON seller_transaction_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 4) Ensure seller invitations table/indexes/trigger
CREATE TABLE IF NOT EXISTS seller_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'expired', 'cancelled')
  ),
  requested_amount DECIMAL(15, 2) NOT NULL CHECK (requested_amount > 0),
  requested_currency VARCHAR(3) NOT NULL DEFAULT 'KES',
  requested_description TEXT NOT NULL,
  accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seller_invitations_email_status
  ON seller_invitations(email, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_invitations_inviter
  ON seller_invitations(invited_by_user_id, created_at DESC);

DROP TRIGGER IF EXISTS seller_invitations_updated_at ON seller_invitations;
CREATE TRIGGER seller_invitations_updated_at
BEFORE UPDATE ON seller_invitations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

