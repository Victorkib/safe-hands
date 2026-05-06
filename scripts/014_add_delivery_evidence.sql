-- Migration: Add delivery_evidence table for structured evidence tracking
-- Phase 3 of Implementation Plan

-- ===== DELIVERY EVIDENCE TABLE =====
-- Stores structured evidence submissions for shipping and delivery confirmation
CREATE TABLE IF NOT EXISTS delivery_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Evidence type and role
  submission_type VARCHAR(30) NOT NULL CHECK (
    submission_type IN ('seller_ship', 'buyer_receive', 'seller_additional', 'buyer_additional')
  ),
  
  -- Shipping details (for seller_ship)
  tracking_number VARCHAR(100),
  courier VARCHAR(100),
  estimated_delivery_date DATE,
  
  -- Delivery confirmation (for buyer_receive)
  condition_rating INT CHECK (condition_rating >= 1 AND condition_rating <= 5),
  item_matches_description BOOLEAN,
  
  -- Common fields
  notes TEXT,
  photos TEXT[], -- Array of photo URLs
  
  -- Timestamps
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for delivery_evidence
CREATE INDEX IF NOT EXISTS idx_delivery_evidence_transaction 
  ON delivery_evidence(transaction_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_evidence_type 
  ON delivery_evidence(submission_type);
CREATE INDEX IF NOT EXISTS idx_delivery_evidence_submitter 
  ON delivery_evidence(submitted_by);

-- Enable RLS
ALTER TABLE delivery_evidence ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_evidence
-- Users can view evidence for transactions they're involved in
CREATE POLICY "Users can view evidence for their transactions" ON delivery_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transactions t 
      WHERE t.id = delivery_evidence.transaction_id 
      AND (t.buyer_id = auth.uid()::uuid OR t.seller_id = auth.uid()::uuid)
    )
    OR EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::uuid AND u.role = 'admin'
    )
  );

-- Users can insert evidence for transactions they're involved in
CREATE POLICY "Users can submit evidence for their transactions" ON delivery_evidence
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions t 
      WHERE t.id = delivery_evidence.transaction_id 
      AND (t.buyer_id = auth.uid()::uuid OR t.seller_id = auth.uid()::uuid)
    )
  );

-- Trigger for updated_at
CREATE TRIGGER delivery_evidence_updated_at BEFORE UPDATE ON delivery_evidence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add tracking columns to transactions table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'tracking_number'
  ) THEN
    ALTER TABLE transactions ADD COLUMN tracking_number VARCHAR(100);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'courier'
  ) THEN
    ALTER TABLE transactions ADD COLUMN courier VARCHAR(100);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'shipped_at'
  ) THEN
    ALTER TABLE transactions ADD COLUMN shipped_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Comments
COMMENT ON TABLE delivery_evidence IS 'Stores structured evidence submissions for shipping and delivery in escrow transactions';
COMMENT ON COLUMN delivery_evidence.submission_type IS 'Type of evidence: seller_ship (shipping proof), buyer_receive (delivery confirmation), or additional evidence';
COMMENT ON COLUMN delivery_evidence.photos IS 'Array of URLs to uploaded evidence photos';
