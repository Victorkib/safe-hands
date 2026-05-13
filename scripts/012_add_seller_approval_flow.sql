-- Seller approval flow foundation

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
