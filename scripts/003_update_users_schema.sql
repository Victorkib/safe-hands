-- Safe Hands Escrow - User Schema Updates
-- This script updates the users table to support buyer_seller role and email verification tracking
-- Run AFTER 001_create_schema.sql and 002_add_auth_tokens.sql

-- ===== ADD EMAIL_VERIFIED_AT COLUMN =====
-- Track when user's email was verified (separate from account creation)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email_verified_at ON users(email_verified_at);

-- ===== UPDATE ROLE CONSTRAINT =====
-- Allow users to be both buyer and seller (buyer_seller role)
-- First drop the existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Recreate with new allowed values
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('buyer', 'seller', 'admin', 'buyer_seller'));

-- ===== COMMENTS =====
COMMENT ON COLUMN users.email_verified_at IS 'Timestamp when email was verified, NULL if not verified';

-- ===== VERIFICATION QUERY =====
-- Run this to verify the changes were applied:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name = 'email_verified_at';
--
-- SELECT conname, consrc 
-- FROM pg_constraint 
-- WHERE conrelid = 'users'::regclass AND contype = 'c';