/**
 * Escrow Service
 * Handles all transaction and escrow logic
 */

import { supabase } from './supabaseClient.js';

class EscrowService {
  /**
   * Create a new transaction
   * @param {Object} params - Transaction parameters
   */
  async createTransaction({
    buyer_id,
    seller_id,
    amount,
    description,
    seller_phone,
    seller_email,
  }) {
    try {
      // Validate
      if (!buyer_id || !seller_id || !amount || amount <= 0) {
        throw new Error('Invalid transaction parameters');
      }

      if (buyer_id === seller_id) {
        throw new Error('Buyer and seller cannot be the same');
      }

      // Create transaction
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          buyer_id,
          seller_id,
          amount: parseFloat(amount),
          description,
          seller_phone,
          seller_email,
          status: 'initiated',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .select()
        .single();

      if (error) throw error;

      // Log to transaction_history
      await this.logTransactionHistory(data.id, 'initiated', 'Transaction created by buyer');

      // Create audit log
      await this.createAuditLog({
        user_id: buyer_id,
        action: 'create_transaction',
        resource_type: 'transaction',
        resource_id: data.id,
        details: { amount, seller_id },
      });

      return data;
    } catch (error) {
      console.error('[v0] Error creating transaction:', error.message);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(transactionId) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(
          `
          *,
          buyer:users(id, full_name, phone_number, avg_rating),
          seller:users(id, full_name, phone_number, avg_rating),
          history:transaction_history(status, created_at, reason),
          dispute:disputes(*)
        `
        )
        .eq('id', transactionId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[v0] Error getting transaction:', error.message);
      throw error;
    }
  }

  /**
   * Update transaction status and M-Pesa reference
   */
  async updateTransactionAfterPayment({
    transaction_id,
    mpesa_ref,
    mpesa_phone,
    mpesa_amount,
  }) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update({
          status: 'escrow',
          mpesa_ref,
          mpesa_phone,
          mpesa_amount: parseFloat(mpesa_amount),
          payment_confirmed_at: new Date(),
          updated_at: new Date(),
        })
        .eq('id', transaction_id)
        .select()
        .single();

      if (error) throw error;

      // Log to transaction_history
      await this.logTransactionHistory(
        transaction_id,
        'escrow',
        `Payment confirmed. M-Pesa Ref: ${mpesa_ref}`
      );

      return data;
    } catch (error) {
      console.error('[v0] Error updating transaction:', error.message);
      throw error;
    }
  }

  /**
   * Seller marks item as shipped
   */
  async markAsShipped({
    transaction_id,
    seller_id,
    delivery_proof_url,
    shipping_note,
  }) {
    try {
      // Verify seller
      const { data: tx } = await supabase
        .from('transactions')
        .select('seller_id, status')
        .eq('id', transaction_id)
        .single();

      if (tx.seller_id !== seller_id) {
        throw new Error('Only the seller can mark as shipped');
      }

      if (tx.status !== 'escrow') {
        throw new Error('Transaction must be in escrow to mark as shipped');
      }

      const { data, error } = await supabase
        .from('transactions')
        .update({
          status: 'shipped',
          delivery_proof_url,
          shipped_at: new Date(),
          shipping_note,
          updated_at: new Date(),
        })
        .eq('id', transaction_id)
        .select()
        .single();

      if (error) throw error;

      await this.logTransactionHistory(
        transaction_id,
        'shipped',
        'Seller marked item as shipped'
      );

      return data;
    } catch (error) {
      console.error('[v0] Error marking as shipped:', error.message);
      throw error;
    }
  }

  /**
   * Buyer confirms delivery
   */
  async confirmDelivery({
    transaction_id,
    buyer_id,
    delivery_confirmation_text,
    rating,
  }) {
    try {
      // Verify buyer
      const { data: tx } = await supabase
        .from('transactions')
        .select('buyer_id, seller_id, status')
        .eq('id', transaction_id)
        .single();

      if (tx.buyer_id !== buyer_id) {
        throw new Error('Only the buyer can confirm delivery');
      }

      if (!['shipped', 'delivered'].includes(tx.status)) {
        throw new Error('Transaction must be shipped to confirm delivery');
      }

      const { data, error } = await supabase
        .from('transactions')
        .update({
          status: 'delivered',
          delivery_confirmed_at: new Date(),
          delivery_confirmation_text,
          updated_at: new Date(),
        })
        .eq('id', transaction_id)
        .select()
        .single();

      if (error) throw error;

      await this.logTransactionHistory(
        transaction_id,
        'delivered',
        'Buyer confirmed delivery'
      );

      // If rating provided, create rating record
      if (rating) {
        await this.createRating({
          transaction_id,
          rater_id: buyer_id,
          rated_user_id: tx.seller_id,
          rating,
        });
      }

      // Trigger fund release (can be auto-release or manual)
      await this.releaseFunds({
        transaction_id,
        released_by: 'auto_delivery_confirmation',
      });

      return data;
    } catch (error) {
      console.error('[v0] Error confirming delivery:', error.message);
      throw error;
    }
  }

  /**
   * Release funds to seller
   */
  async releaseFunds({ transaction_id, released_by = 'manual' }) {
    try {
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('seller_id, amount, status')
        .eq('id', transaction_id)
        .single();

      if (txError) throw txError;

      // Check for active dispute
      const { data: dispute } = await supabase
        .from('disputes')
        .select('status')
        .eq('transaction_id', transaction_id)
        .eq('status', 'open');

      if (dispute && dispute.length > 0) {
        throw new Error('Cannot release funds while dispute is open');
      }

      // Update transaction
      const { data, error } = await supabase
        .from('transactions')
        .update({
          status: 'released',
          funds_released_at: new Date(),
          updated_at: new Date(),
        })
        .eq('id', transaction_id)
        .select()
        .single();

      if (error) throw error;

      await this.logTransactionHistory(
        transaction_id,
        'released',
        `Funds released to seller (${released_by})`
      );

      // Update seller balance (would call payment service in production)
      // For now, just log it

      return data;
    } catch (error) {
      console.error('[v0] Error releasing funds:', error.message);
      throw error;
    }
  }

  /**
   * Get user's transactions
   */
  async getUserTransactions(userId, role = 'all') {
    try {
      let query = supabase
        .from('transactions')
        .select('*,buyer(*),seller(*)');

      if (role === 'buyer') {
        query = query.eq('buyer_id', userId);
      } else if (role === 'seller') {
        query = query.eq('seller_id', userId);
      } else {
        query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
      }

      const { data, error } = await query.order('created_at', {
        ascending: false,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[v0] Error getting user transactions:', error.message);
      throw error;
    }
  }

  /**
   * Log transaction status change
   */
  async logTransactionHistory(transactionId, status, reason) {
    try {
      await supabase.from('transaction_history').insert({
        transaction_id: transactionId,
        status,
        reason,
        created_at: new Date(),
      });
    } catch (error) {
      console.error('[v0] Error logging transaction history:', error.message);
    }
  }

  /**
   * Create rating
   */
  async createRating({ transaction_id, rater_id, rated_user_id, rating }) {
    try {
      const { error } = await supabase.from('ratings').insert({
        transaction_id,
        rater_id,
        rated_user_id,
        rating,
        created_at: new Date(),
      });

      if (error) throw error;

      // Update user avg_rating (would do this with a function in production)
      return true;
    } catch (error) {
      console.error('[v0] Error creating rating:', error.message);
    }
  }

  /**
   * Create audit log
   */
  async createAuditLog({ user_id, action, resource_type, resource_id, details }) {
    try {
      await supabase.from('audit_logs').insert({
        user_id,
        action,
        resource_type,
        resource_id,
        details,
        created_at: new Date(),
      });
    } catch (error) {
      console.error('[v0] Error creating audit log:', error.message);
    }
  }
}

export const escrowService = new EscrowService();
