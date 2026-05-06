-- Add payment_pending state and dedicated M-Pesa receipt column

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_status_check CHECK (
    status IN (
      'initiated',
      'payment_pending',
      'escrow',
      'delivered',
      'released',
      'disputed',
      'refunded',
      'cancelled'
    )
  );

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS mpesa_receipt_number VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_transactions_mpesa_receipt_number
  ON transactions(mpesa_receipt_number);
