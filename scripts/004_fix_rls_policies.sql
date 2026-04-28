-- Safe Hands Escrow - Fix RLS Infinite Recursion
-- This script fixes the infinite recursion issue in RLS policies
-- Run this in Supabase SQL Editor to fix the existing database

-- Drop the problematic admin policy that causes infinite recursion
DROP POLICY IF EXISTS "Admins can view all users" ON users;

-- Create a security definer function to check admin status safely
-- This function runs with elevated privileges and doesn't trigger RLS
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the existing "Users can view their own profile" policy to also allow admins
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (
    id = auth.uid() OR 
    is_admin()
  );

-- Update the update policy to also allow admins
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (
    id = auth.uid() OR 
    is_admin()
  );

-- Add insert policy for new user registration
CREATE POLICY "Enable insert for authenticated users" ON users
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Verify the policies were created correctly
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users' 
ORDER BY policyname;

-- Test the is_admin function
-- SELECT is_admin(); -- Should return false for non-admin users