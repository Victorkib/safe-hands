-- Safe Hands Escrow - Helper Functions
-- RPC functions for safe database operations

-- ===== FUNCTION: Increment user completed transactions =====
-- Used when a transaction is released to update both buyer and seller stats
CREATE OR REPLACE FUNCTION increment_user_completed_transactions(user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE users 
  SET total_transactions_completed = COALESCE(total_transactions_completed, 0) + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (will be called by service role)
GRANT EXECUTE ON FUNCTION increment_user_completed_transactions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_user_completed_transactions(UUID) TO service_role;

-- ===== FUNCTION: Update user average rating =====
-- Called after a new rating is added
CREATE OR REPLACE FUNCTION update_user_avg_rating(target_user_id UUID)
RETURNS void AS $$
DECLARE
  new_avg DECIMAL(3, 2);
BEGIN
  SELECT AVG(rating)::DECIMAL(3, 2) INTO new_avg
  FROM ratings
  WHERE rated_user_id = target_user_id;
  
  UPDATE users
  SET avg_rating = new_avg,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_user_avg_rating(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_avg_rating(UUID) TO service_role;

-- ===== FUNCTION: Get transaction with user details =====
-- Avoids N+1 queries when fetching transactions
CREATE OR REPLACE FUNCTION get_transaction_with_users(transaction_id UUID)
RETURNS TABLE (
  id UUID,
  buyer_id UUID,
  seller_id UUID,
  buyer_email VARCHAR(255),
  buyer_name VARCHAR(255),
  buyer_phone VARCHAR(20),
  seller_email VARCHAR(255),
  seller_name VARCHAR(255),
  seller_phone VARCHAR(20),
  amount DECIMAL(15, 2),
  currency VARCHAR(3),
  description TEXT,
  status VARCHAR(50),
  mpesa_ref VARCHAR(100),
  mpesa_phone VARCHAR(20),
  payment_method VARCHAR(50),
  payment_confirmed_at TIMESTAMP WITH TIME ZONE,
  delivery_proof_url TEXT,
  delivery_confirmed_at TIMESTAMP WITH TIME ZONE,
  buyer_confirmation TEXT,
  is_disputed BOOLEAN,
  auto_release_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.buyer_id,
    t.seller_id,
    b.email AS buyer_email,
    b.full_name AS buyer_name,
    b.phone_number AS buyer_phone,
    s.email AS seller_email,
    s.full_name AS seller_name,
    s.phone_number AS seller_phone,
    t.amount,
    t.currency,
    t.description,
    t.status,
    t.mpesa_ref,
    t.mpesa_phone,
    t.payment_method,
    t.payment_confirmed_at,
    t.delivery_proof_url,
    t.delivery_confirmed_at,
    t.buyer_confirmation,
    t.is_disputed,
    t.auto_release_date,
    t.created_at,
    t.updated_at,
    t.completed_at
  FROM transactions t
  JOIN users b ON t.buyer_id = b.id
  JOIN users s ON t.seller_id = s.id
  WHERE t.id = transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_transaction_with_users(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_transaction_with_users(UUID) TO service_role;

-- ===== FUNCTION: Auto-release funds after timeout =====
-- Called by cron job or manually to release funds for delivered transactions
CREATE OR REPLACE FUNCTION auto_release_funds()
RETURNS INTEGER AS $$
DECLARE
  released_count INTEGER := 0;
  txn RECORD;
BEGIN
  -- Find all delivered transactions past their auto-release date
  FOR txn IN 
    SELECT id, seller_id, buyer_id, amount
    FROM transactions 
    WHERE status = 'delivered' 
      AND auto_release_date IS NOT NULL 
      AND auto_release_date <= CURRENT_TIMESTAMP
      AND is_disputed = false
  LOOP
    -- Update transaction status to released
    UPDATE transactions 
    SET status = 'released',
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = txn.id;
    
    -- Log to transaction history
    INSERT INTO transaction_history (transaction_id, old_status, new_status, reason)
    VALUES (txn.id, 'delivered', 'released', 'Auto-released after timeout period');
    
    -- Update user stats
    PERFORM increment_user_completed_transactions(txn.seller_id);
    PERFORM increment_user_completed_transactions(txn.buyer_id);
    
    -- Create notification for seller
    INSERT INTO notifications (user_id, title, message, type, related_transaction_id)
    VALUES (
      txn.seller_id,
      'Funds Auto-Released',
      'Funds of KES ' || txn.amount::TEXT || ' have been automatically released.',
      'funds_released',
      txn.id
    );
    
    -- Create notification for buyer
    INSERT INTO notifications (user_id, title, message, type, related_transaction_id)
    VALUES (
      txn.buyer_id,
      'Transaction Completed',
      'Transaction auto-completed. Funds released to seller.',
      'transaction_completed',
      txn.id
    );
    
    released_count := released_count + 1;
  END LOOP;
  
  RETURN released_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION auto_release_funds() TO service_role;
