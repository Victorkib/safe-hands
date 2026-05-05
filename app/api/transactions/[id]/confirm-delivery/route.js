import { createClient } from '@supabase/supabase-js';
import { mpesaClient } from '@/lib/mpesaClient';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/transactions/[id]/confirm-delivery
 * Buyer confirms delivery of item
 */
export async function POST(request, { params }) {
  try {
    const { id } = params;

    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return Response.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { confirmation_comment } = body;

    // Get transaction with seller details for payout
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select(`
        *,
        seller:users!transactions_seller_id_fkey (id, phone_number, full_name)
      `)
      .eq('id', id)
      .single();

    if (transactionError || !transaction) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Verify user is the buyer
    if (transaction.buyer_id !== user.id) {
      return Response.json(
        { error: 'Only the buyer can confirm delivery' },
        { status: 403 }
      );
    }

    // Check transaction status
    if (transaction.status !== 'delivered') {
      return Response.json(
        { error: `Cannot confirm delivery for transaction with status: ${transaction.status}` },
        { status: 400 }
      );
    }

    // Update transaction
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'released',
        delivery_confirmed_at: new Date().toISOString(),
        buyer_confirmation: confirmation_comment,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Transaction update error:', updateError);
      return Response.json(
        { error: 'Failed to update transaction' },
        { status: 500 }
      );
    }

    // Log to transaction history
    await supabase.from('transaction_history').insert({
      transaction_id: id,
      old_status: 'delivered',
      new_status: 'released',
      changed_by: user.id,
      reason: `Buyer confirmed delivery: ${confirmation_comment || 'No comment'}`,
    });

    // Update seller's stats using RPC or direct SQL
    // Supabase JS client doesn't have .raw() - use .rpc() for incrementing
    const { error: sellerStatsError } = await supabase.rpc('increment_user_completed_transactions', {
      user_id: transaction.seller_id
    });
    
    if (sellerStatsError) {
      console.error('Failed to update seller stats:', sellerStatsError);
      // Non-critical error, continue execution
    }

    // Update buyer's stats
    const { error: buyerStatsError } = await supabase.rpc('increment_user_completed_transactions', {
      user_id: transaction.buyer_id
    });
    
    if (buyerStatsError) {
      console.error('Failed to update buyer stats:', buyerStatsError);
      // Non-critical error, continue execution
    }

    // Notify seller - funds released
    await supabase.from('notifications').insert({
      user_id: transaction.seller_id,
      title: 'Funds Released',
      message: `Buyer confirmed delivery. Your funds of KES ${transaction.amount.toLocaleString()} are being transferred to your M-Pesa.`,
      type: 'funds_released',
      related_transaction_id: id,
    });

    // Initiate B2C payout to seller's M-Pesa
    let payoutInitiated = false;
    let payoutError = null;

    if (transaction.seller?.phone_number) {
      // Calculate payout amount (could deduct platform fee here)
      const platformFeePercent = 2.5; // 2.5% platform fee
      const platformFee = Math.ceil(transaction.amount * (platformFeePercent / 100));
      const payoutAmount = transaction.amount - platformFee;

      try {
        const b2cResponse = await mpesaClient.initiateB2C({
          phoneNumber: transaction.seller.phone_number,
          amount: payoutAmount,
          remarks: `Safe Hands Escrow payout for transaction ${id.slice(0, 8)}`,
        });

        if (b2cResponse.success) {
          payoutInitiated = true;
          
          // Store the conversation ID for callback matching
          const conversationId = b2cResponse.data?.OriginatorConversationID || b2cResponse.data?.ConversationID;
          
          await supabase
            .from('transactions')
            .update({
              payout_ref: conversationId,
              payout_amount: payoutAmount,
              platform_fee: platformFee,
              payout_status: 'pending',
            })
            .eq('id', id);

          // Log payout initiation
          await supabase.from('transaction_history').insert({
            transaction_id: id,
            old_status: 'released',
            new_status: 'released',
            changed_by: null,
            reason: `B2C payout initiated. Amount: KES ${payoutAmount}, Fee: KES ${platformFee}`,
          });
        } else {
          payoutError = b2cResponse.error;
          console.error('B2C payout initiation failed:', payoutError);
          
          // Mark payout as failed
          await supabase
            .from('transactions')
            .update({
              payout_status: 'failed',
              payout_error: payoutError,
            })
            .eq('id', id);
        }
      } catch (error) {
        payoutError = error.message;
        console.error('B2C payout error:', error);
        
        // Mark payout as failed
        await supabase
          .from('transactions')
          .update({
            payout_status: 'failed',
            payout_error: payoutError,
          })
          .eq('id', id);
      }
    } else {
      payoutError = 'Seller phone number not found';
      console.error('Cannot initiate payout: seller phone number not found');
      
      // Mark payout as failed
      await supabase
        .from('transactions')
        .update({
          payout_status: 'failed',
          payout_error: payoutError,
        })
        .eq('id', id);
    }

    // If payout failed, notify admin
    if (!payoutInitiated) {
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const adminNotifications = admins.map(admin => ({
          user_id: admin.id,
          title: 'Payout Failed - Action Required',
          message: `B2C payout failed for transaction ${id.slice(0, 8)}. Error: ${payoutError}. Manual payout may be required.`,
          type: 'payout_failed',
          related_transaction_id: id,
        }));

        await supabase.from('notifications').insert(adminNotifications);
      }
    }

    return Response.json({
      success: true,
      message: payoutInitiated 
        ? 'Delivery confirmed. Funds are being transferred to seller.' 
        : 'Delivery confirmed. Payout is being processed manually.',
      payoutInitiated,
    });

  } catch (error) {
    console.error('Delivery confirmation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
