-- Safe Hands Escrow - Add Payout Columns to Transactions
-- Adds columns needed for B2C payout tracking

-- Add payout-related columns to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payout_ref VARCHAR(100),
ADD COLUMN IF NOT EXISTS payout_mpesa_ref VARCHAR(100),
ADD COLUMN IF NOT EXISTS payout_amount DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS payout_status VARCHAR(50) DEFAULT NULL CHECK (
  payout_status IS NULL OR payout_status IN ('pending', 'completed', 'failed')
),
ADD COLUMN IF NOT EXISTS payout_error TEXT,
ADD COLUMN IF NOT EXISTS payout_confirmed_at TIMESTAMP WITH TIME ZONE;

-- Add index for payout reference lookup (used by B2C callback)
CREATE INDEX IF NOT EXISTS idx_transactions_payout_ref ON transactions(payout_ref);

-- Add comments
COMMENT ON COLUMN transactions.payout_ref IS 'M-Pesa B2C OriginatorConversationID for callback matching';
COMMENT ON COLUMN transactions.payout_mpesa_ref IS 'M-Pesa B2C TransactionReceipt after successful payout';
COMMENT ON COLUMN transactions.payout_amount IS 'Amount paid out to seller (after platform fee)';
COMMENT ON COLUMN transactions.platform_fee IS 'Platform fee deducted from transaction amount';
COMMENT ON COLUMN transactions.payout_status IS 'Status of B2C payout: pending, completed, or failed';
COMMENT ON COLUMN transactions.payout_error IS 'Error message if payout failed';
COMMENT ON COLUMN transactions.payout_confirmed_at IS 'Timestamp when B2C payout was confirmed';
