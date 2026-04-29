/**
 * Payment Service
 * Wraps M-Pesa client for business logic
 */

import mpesaClient from './mpesaClient.js';
import { supabase } from './supabaseClient.js';
import { emailService } from './emailService.js';

class PaymentService {
  /**
   * Initiate payment for transaction
   */
  async initiatePayment({
    transaction_id,
    buyer_id,
    phone_number,
    amount,
  }) {
    try {
      console.log('[v0] Initiating payment for transaction:', transaction_id);

      // Validate phone number
      const formattedPhone = mpesaClient.formatPhoneNumber(phone_number);
      if (!formattedPhone.match(/^254\d{9}$/)) {
        throw new Error('Invalid phone number format');
      }

      // Initiate STK push
      const stkResponse = await mpesaClient.initiateSTKPush({
        phoneNumber: formattedPhone,
        amount: Math.round(amount),
        accountReference: transaction_id,
        transactionDesc: `SafeHands Escrow - Transaction ${transaction_id}`,
      });

      console.log('[v0] STK Push initiated:', stkResponse);

      // Store payment request info
      await supabase
        .from('transactions')
        .update({
          payment_request_id: stkResponse.RequestId,
          payment_initiated_at: new Date(),
          updated_at: new Date(),
        })
        .eq('id', transaction_id);

      return {
        success: true,
        requestId: stkResponse.RequestId,
        message: 'Payment prompt sent to your phone',
      };
    } catch (error) {
      console.error('[v0] Error initiating payment:', error.message);
      throw error;
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(transaction_id) {
    try {
      const { data: tx } = await supabase
        .from('transactions')
        .select('payment_request_id, mpesa_ref, status')
        .eq('id', transaction_id)
        .single();

      if (!tx || !tx.payment_request_id) {
        throw new Error('No payment request found');
      }

      // If already confirmed, return early
      if (tx.status === 'escrow' && tx.mpesa_ref) {
        return {
          status: 'confirmed',
          mpesa_ref: tx.mpesa_ref,
        };
      }

      // Query M-Pesa for status (would be done via callback in production)
      // For now, return pending
      return {
        status: 'pending',
        message: 'Waiting for payment confirmation',
      };
    } catch (error) {
      console.error('[v0] Error checking payment status:', error.message);
      throw error;
    }
  }

  /**
   * Handle M-Pesa callback
   */
  async handleMpesaCallback(callbackData) {
    try {
      console.log('[v0] M-Pesa callback received');

      const {
        Body: {
          stkCallback: {
            MerchantRequestID,
            CheckoutRequestID,
            ResultCode,
            ResultDesc,
            CallbackMetadata,
          },
        },
      } = callbackData;

      // Get transaction by request ID
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('id, buyer_id, seller_id, amount, status')
        .eq('payment_request_id', CheckoutRequestID)
        .single();

      if (txError || !tx) {
        console.error('[v0] Transaction not found for callback:', CheckoutRequestID);
        return { error: 'Transaction not found' };
      }

      if (ResultCode === '0') {
        // Payment successful
        const metadata = CallbackMetadata.Item.reduce((acc, item) => {
          acc[item.Name] = item.Value;
          return acc;
        }, {});

        const mpesaRef = metadata.MpesaReceiptNumber;
        const mpesaAmount = metadata.Amount;
        const mpesaPhone = metadata.PhoneNumber;

        // Update transaction
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            status: 'escrow',
            mpesa_ref: mpesaRef,
            mpesa_phone: mpesaPhone,
            mpesa_amount: mpesaAmount,
            payment_confirmed_at: new Date(),
            updated_at: new Date(),
          })
          .eq('id', tx.id);

        if (updateError) throw updateError;

        // Log transaction history
        await supabase.from('transaction_history').insert({
          transaction_id: tx.id,
          status: 'escrow',
          reason: `Payment confirmed. M-Pesa Ref: ${mpesaRef}`,
          created_at: new Date(),
        });

        // Send notification to seller
        await this.sendPaymentNotification({
          user_id: tx.seller_id,
          buyer_id: tx.buyer_id,
          transaction_id: tx.id,
          amount: tx.amount,
          type: 'payment_received',
        });

        // Send notification to buyer
        await this.sendPaymentNotification({
          user_id: tx.buyer_id,
          buyer_id: tx.buyer_id,
          transaction_id: tx.id,
          amount: tx.amount,
          type: 'payment_confirmed',
        });

        console.log('[v0] Payment successful for transaction:', tx.id);

        return {
          success: true,
          transactionId: tx.id,
          mpesaRef,
        };
      } else {
        // Payment failed
        console.log('[v0] Payment failed:', ResultDesc);

        // Update transaction status to failed
        await supabase
          .from('transactions')
          .update({
            status: 'payment_failed',
            payment_failed_reason: ResultDesc,
            updated_at: new Date(),
          })
          .eq('id', tx.id);

        return {
          success: false,
          error: ResultDesc,
        };
      }
    } catch (error) {
      console.error('[v0] Error handling M-Pesa callback:', error.message);
      throw error;
    }
  }

  /**
   * Send payment notification
   */
  async sendPaymentNotification({
    user_id,
    buyer_id,
    transaction_id,
    amount,
    type,
  }) {
    try {
      // Get user details
      const { data: user } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('id', user_id)
        .single();

      // Create in-app notification
      await supabase.from('notifications').insert({
        user_id,
        title:
          type === 'payment_received' ? 'Payment Received' : 'Payment Confirmed',
        message:
          type === 'payment_received'
            ? `Payment of KES ${amount} received for transaction`
            : `Your payment of KES ${amount} has been confirmed`,
        type,
        related_transaction_id: transaction_id,
        is_read: false,
        created_at: new Date(),
      });

      // Send email for critical events
      if (type === 'payment_received') {
        await emailService.sendEmail({
          to: user.email,
          subject: 'Payment Received - SafeHands Escrow',
          template: 'payment_received',
          data: {
            name: user.full_name,
            amount,
            transactionId: transaction_id,
          },
        });
      }
    } catch (error) {
      console.error('[v0] Error sending payment notification:', error.message);
    }
  }

  /**
   * Release payment to seller (after delivery confirmed or dispute resolved)
   */
  async releasePayment(transaction_id) {
    try {
      const { data: tx } = await supabase
        .from('transactions')
        .select('seller_id, buyer_id, amount, mpesa_ref')
        .eq('id', transaction_id)
        .single();

      if (!tx) throw new Error('Transaction not found');

      // In production, would call M-Pesa B2C API to transfer funds
      // For now, just update transaction status
      await supabase
        .from('transactions')
        .update({
          status: 'released',
          funds_released_at: new Date(),
          updated_at: new Date(),
        })
        .eq('id', transaction_id);

      // Create transaction history record
      await supabase.from('transaction_history').insert({
        transaction_id,
        status: 'released',
        reason: 'Funds released to seller account',
        created_at: new Date(),
      });

      // Notify seller
      const { data: seller } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('id', tx.seller_id)
        .single();

      await supabase.from('notifications').insert({
        user_id: tx.seller_id,
        title: 'Funds Released',
        message: `Funds of KES ${tx.amount} released to your account`,
        type: 'funds_released',
        related_transaction_id: transaction_id,
        is_read: false,
        created_at: new Date(),
      });

      // Send email
      await emailService.sendEmail({
        to: seller.email,
        subject: 'Funds Released - SafeHands Escrow',
        template: 'funds_released',
        data: {
          name: seller.full_name,
          amount: tx.amount,
          transactionId: transaction_id,
        },
      });

      return true;
    } catch (error) {
      console.error('[v0] Error releasing payment:', error.message);
      throw error;
    }
  }

  /**
   * Refund payment to buyer
   */
  async refundPayment(transaction_id) {
    try {
      const { data: tx } = await supabase
        .from('transactions')
        .select('buyer_id, seller_id, amount, mpesa_phone, mpesa_ref')
        .eq('id', transaction_id)
        .single();

      if (!tx) throw new Error('Transaction not found');

      // In production, would call M-Pesa B2C API
      // For now, just update transaction status
      await supabase
        .from('transactions')
        .update({
          status: 'refunded',
          refund_initiated_at: new Date(),
          updated_at: new Date(),
        })
        .eq('id', transaction_id);

      // Notify buyer
      const { data: buyer } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('id', tx.buyer_id)
        .single();

      await supabase.from('notifications').insert({
        user_id: tx.buyer_id,
        title: 'Refund Processed',
        message: `Refund of KES ${tx.amount} processed to your M-Pesa`,
        type: 'refund_processed',
        related_transaction_id: transaction_id,
        is_read: false,
        created_at: new Date(),
      });

      // Send email
      await emailService.sendEmail({
        to: buyer.email,
        subject: 'Refund Processed - SafeHands Escrow',
        template: 'refund_processed',
        data: {
          name: buyer.full_name,
          amount: tx.amount,
          transactionId: transaction_id,
        },
      });

      return true;
    } catch (error) {
      console.error('[v0] Error refunding payment:', error.message);
      throw error;
    }
  }
}

export const paymentService = new PaymentService();
