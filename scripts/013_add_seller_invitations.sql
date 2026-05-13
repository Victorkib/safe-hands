-- Seller invitations for external sellers without accounts

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
