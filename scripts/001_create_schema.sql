-- Safe Hands Escrow - Database Schema
-- This script creates all necessary tables and functions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== USERS TABLE =====
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20) UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'admin', 'buyer_seller')), -- buyer, seller, admin, or both buyer_seller
  kyc_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected')),
  kyc_data JSONB, -- Store ID type, ID number, address, etc.
  profile_picture_url TEXT,
  bio TEXT,
  is_active BOOLEAN DEFAULT true,
  account_balance DECIMAL(15, 2) DEFAULT 0.00, -- For future use: wallet balance
  total_transactions_completed INT DEFAULT 0,
  avg_rating DECIMAL(3, 2),
  email_verified_at TIMESTAMP WITH TIME ZONE, -- Track when email was verified
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ===== TRANSACTIONS TABLE =====
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'KES',
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'initiated' CHECK (
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
  ),
  
  -- Payment details
  mpesa_ref VARCHAR(100), -- M-Pesa reference number
  mpesa_receipt_number VARCHAR(100), -- M-Pesa receipt number after successful payment
  mpesa_phone VARCHAR(20), -- Phone number used for M-Pesa
  payment_method VARCHAR(50) DEFAULT 'mpesa', -- 'mpesa', 'bank_transfer', etc.
  payment_confirmed_at TIMESTAMP WITH TIME ZONE,
  
  -- Delivery details
  delivery_proof_url TEXT, -- Seller's shipping proof
  delivery_confirmed_at TIMESTAMP WITH TIME ZONE,
  buyer_confirmation TEXT, -- Buyer's delivery confirmation comment
  
  -- Dispute details
  is_disputed BOOLEAN DEFAULT false,
  auto_release_date TIMESTAMP WITH TIME ZONE, -- Auto-release funds after 3 days if no dispute
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes on transactions
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_mpesa_ref ON transactions(mpesa_ref);
CREATE INDEX IF NOT EXISTS idx_transactions_mpesa_receipt_number ON transactions(mpesa_receipt_number);

-- ===== TRANSACTION HISTORY TABLE =====
-- For audit trail: logs every status change
CREATE TABLE IF NOT EXISTS transaction_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transaction_history_tx ON transaction_history(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_history_created ON transaction_history(created_at DESC);

-- ===== SELLER TRANSACTION REQUESTS =====
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

-- ===== SELLER INVITATIONS =====
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

-- ===== DISPUTES TABLE =====
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE UNIQUE,
  raised_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  raised_against UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Dispute details
  reason VARCHAR(100) NOT NULL, -- 'item_not_received', 'item_not_as_described', 'other'
  description TEXT NOT NULL,
  evidence_urls TEXT[], -- Array of evidence file URLs
  
  -- Dispute resolution
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'in_review', 'awaiting_response', 'resolved', 'closed')
  ),
  resolution VARCHAR(50) CHECK (
    resolution IN ('refund_buyer', 'release_to_seller', 'partial_refund', 'cancelled')
  ),
  admin_notes TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_disputes_transaction ON disputes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_raised_by ON disputes(raised_by);
CREATE INDEX IF NOT EXISTS idx_disputes_created ON disputes(created_at DESC);

-- ===== NOTIFICATIONS TABLE =====
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'payment_received', 'delivery_confirmed', 'dispute_raised', 'dispute_resolved', etc.
  related_transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ===== RATINGS & REVIEWS TABLE =====
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE UNIQUE,
  rater_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rated_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Rating details
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  categories JSONB, -- { "communication": 5, "delivery": 4, "item_quality": 5 }
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ratings_rated_user ON ratings(rated_user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_transaction ON ratings(transaction_id);

-- ===== AUDIT LOG TABLE =====
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- 'login', 'create_transaction', 'resolve_dispute', etc.
  resource_type VARCHAR(50), -- 'transaction', 'dispute', 'user', etc.
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- ===== FUNCTION: Update updated_at timestamp =====
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER disputes_updated_at BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER ratings_updated_at BEFORE UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER seller_transaction_requests_updated_at BEFORE UPDATE ON seller_transaction_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER seller_invitations_updated_at BEFORE UPDATE ON seller_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== ROW LEVEL SECURITY (RLS) POLICIES =====
-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_transaction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_invitations ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile OR if they are admin (using auth.uid() directly to avoid recursion)
-- Note: We use a security definer function to check admin status safely
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (
    id = auth.uid() OR 
    is_admin()
  );

-- Users can update their own profile (admins can also update any profile)
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (
    id = auth.uid() OR 
    is_admin()
  );

-- Allow insert for new user registration (used by supabaseAdmin)
CREATE POLICY "Enable insert for authenticated users" ON users
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can view transactions they are involved in
CREATE POLICY "Users can view their transactions" ON transactions
  FOR SELECT USING (
    buyer_id = auth.uid()::uuid OR 
    seller_id = auth.uid()::uuid OR
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::uuid AND u.role = 'admin'
    )
  );

-- Users can see notifications for themselves
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid()::uuid);

-- Users can mark their notifications as read
CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid()::uuid);

-- Insert permissions for notifications
CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Users can view disputes they are involved in
CREATE POLICY "Users can view their disputes" ON disputes
  FOR SELECT USING (
    raised_by = auth.uid()::uuid OR 
    raised_against = auth.uid()::uuid OR
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::uuid AND u.role = 'admin'
    )
  );

-- Admins can update disputes
CREATE POLICY "Admins can update disputes" ON disputes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid()::uuid AND u.role = 'admin'
    )
  );

-- Users can view approval requests they are part of
CREATE POLICY "Users can view their seller transaction requests" ON seller_transaction_requests
  FOR SELECT USING (
    seller_id = auth.uid()::uuid OR
    buyer_id = auth.uid()::uuid OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::uuid AND u.role = 'admin'
    )
  );

-- System-level inserts for approval requests
CREATE POLICY "System can insert seller transaction requests" ON seller_transaction_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their seller invitations" ON seller_invitations
  FOR SELECT USING (
    invited_by_user_id = auth.uid()::uuid OR
    accepted_by_user_id = auth.uid()::uuid OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()::uuid AND u.role = 'admin'
    )
  );

CREATE POLICY "System can insert seller invitations" ON seller_invitations
  FOR INSERT WITH CHECK (true);

-- ===== COMMENTS (Documentation) =====
COMMENT ON TABLE users IS 'Stores user account information, roles, and KYC status';
COMMENT ON TABLE transactions IS 'Core escrow transactions between buyers and sellers';
COMMENT ON TABLE transaction_history IS 'Audit trail of all transaction status changes';
COMMENT ON TABLE disputes IS 'Dispute/conflict resolution records';
COMMENT ON TABLE notifications IS 'User notifications for transaction updates';
COMMENT ON TABLE ratings IS 'User ratings and reviews after completed transactions';
COMMENT ON TABLE audit_logs IS 'System audit trail for compliance and security';
