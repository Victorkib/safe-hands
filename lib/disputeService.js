/**
 * Dispute Service
 * Handles dispute creation, resolution, and management
 */

import { supabase } from './supabaseClient.js';

class DisputeService {
  /**
   * Create a dispute
   */
  async createDispute({
    transaction_id,
    raised_by,
    reason,
    description,
    evidence_urls = [],
  }) {
    try {
      // Get transaction to find other party
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('buyer_id, seller_id, status')
        .eq('id', transaction_id)
        .single();

      if (txError) throw txError;

      // Determine who dispute is raised against
      const raised_against =
        raised_by === tx.buyer_id ? tx.seller_id : tx.buyer_id;

      // Create dispute
      const { data, error } = await supabase
        .from('disputes')
        .insert({
          transaction_id,
          raised_by,
          raised_against,
          reason,
          description,
          evidence_urls,
          status: 'open',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .select()
        .single();

      if (error) throw error;

      // Prevent auto-release
      await supabase
        .from('transactions')
        .update({
          auto_release_blocked: true,
          status: 'disputed',
          updated_at: new Date(),
        })
        .eq('id', transaction_id);

      // Create notification for admin
      await this.notifyAdmins({
        title: 'New Dispute Raised',
        message: `Dispute raised for transaction ${transaction_id}`,
        type: 'dispute_raised',
        related_transaction_id: transaction_id,
      });

      // Create notification for other party
      await this.createNotification({
        user_id: raised_against,
        title: 'Dispute Raised Against You',
        message: `A dispute has been raised for transaction ${transaction_id}`,
        type: 'dispute_raised',
        related_transaction_id: transaction_id,
      });

      return data;
    } catch (error) {
      console.error('[v0] Error creating dispute:', error.message);
      throw error;
    }
  }

  /**
   * Get dispute details
   */
  async getDispute(disputeId) {
    try {
      const { data, error } = await supabase
        .from('disputes')
        .select(
          `
          *,
          transaction:transactions(*),
          raised_by_user:users(id, full_name, avg_rating),
          raised_against_user:users(id, full_name, avg_rating),
          resolved_by_user:users(id, full_name)
        `
        )
        .eq('id', disputeId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[v0] Error getting dispute:', error.message);
      throw error;
    }
  }

  /**
   * Resolve dispute (Admin only)
   */
  async resolveDispute({
    dispute_id,
    admin_id,
    resolution,
    admin_notes,
  }) {
    try {
      // Verify admin role
      const { data: admin, error: adminError } = await supabase
        .from('users')
        .select('role')
        .eq('id', admin_id)
        .single();

      if (adminError || admin.role !== 'admin') {
        throw new Error('Only admins can resolve disputes');
      }

      // Get dispute to find transaction
      const { data: dispute, error: disputeError } = await supabase
        .from('disputes')
        .select('transaction_id, raised_by, raised_against')
        .eq('id', dispute_id)
        .single();

      if (disputeError) throw disputeError;

      // Update dispute
      const { data, error } = await supabase
        .from('disputes')
        .update({
          status: 'resolved',
          resolution,
          admin_notes,
          resolved_by: admin_id,
          resolved_at: new Date(),
          updated_at: new Date(),
        })
        .eq('id', dispute_id)
        .select()
        .single();

      if (error) throw error;

      // Update transaction based on resolution
      if (resolution === 'refund_buyer') {
        await supabase
          .from('transactions')
          .update({
            status: 'refunded',
            refund_initiated_at: new Date(),
            updated_at: new Date(),
          })
          .eq('id', dispute.transaction_id);

        // Notify buyer of refund
        await this.createNotification({
          user_id: dispute.raised_by,
          title: 'Dispute Resolved - Refund Approved',
          message: 'Your refund has been approved',
          type: 'dispute_resolved',
          related_transaction_id: dispute.transaction_id,
        });

        // Notify seller
        await this.createNotification({
          user_id: dispute.raised_against,
          title: 'Dispute Resolved - Refund to Buyer',
          message: 'Dispute resolved. Funds refunded to buyer',
          type: 'dispute_resolved',
          related_transaction_id: dispute.transaction_id,
        });
      } else if (resolution === 'release_to_seller') {
        // Call escrow service to release funds
        await supabase
          .from('transactions')
          .update({
            status: 'released',
            funds_released_at: new Date(),
            updated_at: new Date(),
          })
          .eq('id', dispute.transaction_id);

        // Notify seller of release
        await this.createNotification({
          user_id: dispute.raised_against,
          title: 'Dispute Resolved - Funds Released',
          message: 'Dispute resolved. Funds released to your account',
          type: 'dispute_resolved',
          related_transaction_id: dispute.transaction_id,
        });

        // Notify buyer
        await this.createNotification({
          user_id: dispute.raised_by,
          title: 'Dispute Resolved',
          message: 'Dispute has been resolved. Funds released to seller',
          type: 'dispute_resolved',
          related_transaction_id: dispute.transaction_id,
        });
      }

      return data;
    } catch (error) {
      console.error('[v0] Error resolving dispute:', error.message);
      throw error;
    }
  }

  /**
   * Get open disputes (Admin view)
   */
  async getOpenDisputes({ status = 'open', limit = 50, offset = 0 } = {}) {
    try {
      const { data, error } = await supabase
        .from('disputes')
        .select(
          `
          *,
          transaction:transactions(id, buyer_id, seller_id, amount, description),
          raised_by_user:users(id, full_name, avg_rating),
          raised_against_user:users(id, full_name, avg_rating)
        `
        )
        .eq('status', status)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[v0] Error getting open disputes:', error.message);
      throw error;
    }
  }

  /**
   * Get user's disputes
   */
  async getUserDisputes(userId) {
    try {
      const { data, error } = await supabase
        .from('disputes')
        .select(
          `
          *,
          transaction:transactions(*),
          raised_by_user:users(id, full_name),
          raised_against_user:users(id, full_name)
        `
        )
        .or(`raised_by.eq.${userId},raised_against.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[v0] Error getting user disputes:', error.message);
      throw error;
    }
  }

  /**
   * Create notification
   */
  async createNotification({
    user_id,
    title,
    message,
    type,
    related_transaction_id,
  }) {
    try {
      await supabase.from('notifications').insert({
        user_id,
        title,
        message,
        type,
        related_transaction_id,
        is_read: false,
        created_at: new Date(),
      });
    } catch (error) {
      console.error('[v0] Error creating notification:', error.message);
    }
  }

  /**
   * Notify all admins
   */
  async notifyAdmins({ title, message, type, related_transaction_id }) {
    try {
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');

      if (!admins) return;

      for (const admin of admins) {
        await this.createNotification({
          user_id: admin.id,
          title,
          message,
          type,
          related_transaction_id,
        });
      }
    } catch (error) {
      console.error('[v0] Error notifying admins:', error.message);
    }
  }
}

export const disputeService = new DisputeService();
