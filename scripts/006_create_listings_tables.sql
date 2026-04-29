-- Create categories and listings tables for marketplace functionality
-- Run this in Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Listings table
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(15, 2) NOT NULL CHECK (price > 0),
  currency VARCHAR(3) DEFAULT 'KES',
  images TEXT[], -- Array of image URLs
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'inactive', 'deleted')),
  location VARCHAR(255),
  condition VARCHAR(50) CHECK (condition IN ('new', 'used_like_new', 'used_good', 'used_fair')),
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sold_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_listings_seller_id ON listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_category_id ON listings(category_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Categories
-- Public read access for categories
CREATE POLICY "Categories are public read" ON categories
  FOR SELECT TO public USING (true);

-- RLS Policies for Listings
-- Public read access for active listings
CREATE POLICY "Listings are public read" ON listings
  FOR SELECT TO public USING (status = 'active');

-- Authenticated sellers can create listings
CREATE POLICY "Sellers can create listings" ON listings
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid()::text = seller_id::text
  );

-- Sellers can update their own listings
CREATE POLICY "Sellers can update own listings" ON listings
  FOR UPDATE TO authenticated USING (
    auth.uid()::text = seller_id::text
  );

-- Sellers can delete their own listings
CREATE POLICY "Sellers can delete own listings" ON listings
  FOR DELETE TO authenticated USING (
    auth.uid()::text = seller_id::text
  );

-- Insert default categories
INSERT INTO categories (name, slug, description) VALUES
  ('Electronics', 'electronics', 'Phones, laptops, gadgets, and other electronic devices'),
  ('Fashion', 'fashion', 'Clothing, shoes, accessories, and fashion items'),
  ('Home & Garden', 'home-garden', 'Furniture, appliances, decor, and home items'),
  ('Vehicles', 'vehicles', 'Cars, motorcycles, parts, and vehicle accessories'),
  ('Services', 'services', 'Professional services, gigs, and service offerings'),
  ('Other', 'other', 'Items not in other categories')
ON CONFLICT (name) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT 'Listings and categories tables created successfully!' AS status;
