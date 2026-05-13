import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './emailService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Notification Service
 * Handles in-app notifications and email notifications for critical events
 */

const NOTIFICATION_TYPES = {
  // Transaction events
  transaction_created: 'Transaction Created',
  payment_initiated: 'Payment Initiated',
  payment_pending: 'Payment Pending',
  payment_received: 'Payment Received',
  payment_failed: 'Payment Failed',
  item_shipped: 'Item Shipped',
  funds_released: 'Funds Released',
  delivery_confirmed: 'Delivery Confirmed',
  
  // Seller approval events
  seller_approval_requested: 'Seller Approval Requested',
  seller_approved: 'Seller Approved',
  seller_rejected: 'Seller Rejected',
  seller_change_requested: 'Seller Change Requested',
  seller_changes_accepted: 'Seller Changes Accepted',
  
  // Dispute events
  dispute_raised: 'Dispute Raised',
  dispute_resolved: 'Dispute Resolved',
  dispute_review: 'Dispute Review Required',
  
  // Auto-release events
  auto_release_warning: 'Auto-Release Warning',
  auto_release_executed: 'Funds Auto-Released',
  dispute_window_started: 'Dispute Window Started',
  withdrawal_completed: 'Withdrawal completed',
};

/**
 * Create an in-app notification
 */
async function createInAppNotification(userId, title, message, type, relatedTransactionId = null) {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      related_transaction_id: relatedTransactionId,
    });

    if (error) {
      console.error('Failed to create in-app notification:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error creating in-app notification:', error);
    return false;
  }
}

/**
 * Send email notification for critical events
 */
async function sendEmailNotification(userEmail, subject, htmlContent) {
  try {
    await sendEmail({
      to: userEmail,
      subject,
      html: htmlContent,
    });
    return true;
  } catch (error) {
    console.error('Failed to send email notification:', error);
    return false;
  }
}

/**
 * Create notification (in-app + email for critical events)
 */
async function createNotification(userId, userEmail, title, message, type, relatedTransactionId = null, transaction = null) {
  // Always create in-app notification
  await createInAppNotification(userId, title, message, type, relatedTransactionId);

  // Send email for critical events
  const criticalTypes = [
    'payment_received',
    'payment_failed',
    'funds_released',
    'dispute_raised',
    'dispute_resolved',
    'auto_release_warning',
    'auto_release_executed',
    'seller_approved',
    'seller_rejected',
  ];

  if (criticalTypes.includes(type) && userEmail) {
    const emailSubject = `Safe Hands Escrow - ${title}`;
    const emailHtml = generateEmailTemplate(type, title, message, transaction);
    await sendEmailNotification(userEmail, emailSubject, emailHtml);
  }
}

/**
 * Generate email HTML template
 */
function generateEmailTemplate(type, title, message, transaction = null) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  let actionUrl = `${baseUrl}/dashboard`;
  let actionText = 'View Dashboard';

  if (transaction) {
    actionUrl = `${baseUrl}/dashboard/transactions/${transaction.id}`;
    actionText = 'View Transaction';
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .button {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 5px;
          margin-top: 20px;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Safe Hands Escrow</h1>
      </div>
      <div class="content">
        <h2>${title}</h2>
        <p>${message}</p>
        ${transaction ? `
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Amount:</strong> KES ${transaction.amount?.toLocaleString() || 'N/A'}</p>
          <p><strong>Description:</strong> ${transaction.description || 'N/A'}</p>
        </div>
        ` : ''}
        <a href="${actionUrl}" class="button">${actionText}</a>
      </div>
      <div class="footer">
        <p>This is an automated email from Safe Hands Escrow.</p>
        <p>Please do not reply to this email.</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Notify transaction parties
 */
async function notifyTransactionParties(transaction, eventType, customMessage = null) {
  try {
    // Get user emails
    const { data: buyer } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', transaction.buyer_id)
      .single();

    const { data: seller } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', transaction.seller_id)
      .single();

    if (!buyer || !seller) {
      console.error('Failed to fetch user details for notification');
      return;
    }

    const notificationConfig = getNotificationConfig(eventType, transaction);
    
    if (!notificationConfig) {
      console.error('Unknown notification type:', eventType);
      return;
    }

    // Notify buyer
    await createNotification(
      transaction.buyer_id,
      buyer.email,
      notificationConfig.buyerTitle,
      customMessage || notificationConfig.buyerMessage,
      eventType,
      transaction.id,
      transaction
    );

    // Notify seller
    await createNotification(
      transaction.seller_id,
      seller.email,
      notificationConfig.sellerTitle,
      customMessage || notificationConfig.sellerMessage,
      eventType,
      transaction.id,
      transaction
    );
  } catch (error) {
    console.error('Error notifying transaction parties:', error);
  }
}

/**
 * Get notification configuration for event type
 */
function getNotificationConfig(eventType, transaction) {
  const amount = transaction.amount?.toLocaleString() || '0';

  const configs = {
    payment_received: {
      buyerTitle: 'Payment Received',
      buyerMessage: `Your payment of KES ${amount} has been received and is now in escrow.`,
      sellerTitle: 'Payment Received',
      sellerMessage: `Payment of KES ${amount} has been received. You can now ship the item.`,
    },
    payment_failed: {
      buyerTitle: 'Payment Failed',
      buyerMessage: 'Your payment failed. Please try again.',
      sellerTitle: null,
      sellerMessage: null,
    },
    item_shipped: {
      buyerTitle: 'Item Shipped',
      buyerMessage: 'Your item has been shipped. Please confirm delivery within 3 days.',
      sellerTitle: null,
      sellerMessage: null,
    },
    funds_released: {
      buyerTitle: 'Delivery Confirmed',
      buyerMessage: 'You have confirmed delivery. The transaction is complete.',
      sellerTitle: 'Funds Released',
      sellerMessage: `Buyer confirmed delivery. Your funds of KES ${amount} have been released.`,
    },
    dispute_raised: {
      buyerTitle: 'Dispute Raised',
      buyerMessage: 'You have raised a dispute. An admin will review it shortly.',
      sellerTitle: 'Dispute Raised Against You',
      sellerMessage: 'A dispute has been raised against you. Please provide evidence.',
    },
    dispute_resolved: {
      buyerTitle: 'Dispute Resolved',
      buyerMessage: 'The dispute has been resolved. Check your dashboard for details.',
      sellerTitle: 'Dispute Resolved',
      sellerMessage: 'The dispute has been resolved. Check your dashboard for details.',
    },
    auto_release_warning: {
      buyerTitle: 'Auto-Release in 24 Hours',
      buyerMessage: `Funds for KES ${amount} will be automatically released to the seller in 24 hours. Raise a dispute now if there are issues.`,
      sellerTitle: 'Funds Releasing Soon',
      sellerMessage: `Funds of KES ${amount} will be auto-released to you in 24 hours if no dispute is raised.`,
    },
    auto_release_executed: {
      buyerTitle: 'Funds Auto-Released',
      buyerMessage: `Funds of KES ${amount} have been automatically released to the seller.`,
      sellerTitle: 'Funds Auto-Released',
      sellerMessage: `Funds of KES ${amount} have been automatically released to you.`,
    },
    dispute_window_started: {
      buyerTitle: 'Dispute Window Open',
      buyerMessage: `Item has been marked shipped. You have 3 days to confirm delivery or raise a dispute.`,
      sellerTitle: null,
      sellerMessage: null,
    },
    seller_approved: {
      buyerTitle: 'Seller Approved Transaction',
      buyerMessage: 'Seller approved your transaction. You can now proceed with payment.',
      sellerTitle: null,
      sellerMessage: null,
    },
    seller_rejected: {
      buyerTitle: 'Seller Rejected Transaction',
      buyerMessage: 'Seller rejected your transaction request.',
      sellerTitle: null,
      sellerMessage: null,
    },
    seller_change_requested: {
      buyerTitle: 'Seller Requested Changes',
      buyerMessage: 'Seller has requested changes to the transaction. Please review.',
      sellerTitle: null,
      sellerMessage: null,
    },
  };

  return configs[eventType] || null;
}

/**
 * Notify admins
 */
async function notifyAdmins(title, message, type, relatedTransactionId = null) {
  try {
    const { data: admins } = await supabase
      .from('users')
      .select('id, email')
      .eq('role', 'admin');

    if (!admins || admins.length === 0) {
      console.warn('No admins found to notify');
      return;
    }

    for (const admin of admins) {
      await createNotification(
        admin.id,
        admin.email,
        title,
        message,
        type,
        relatedTransactionId,
        null
      );
    }
  } catch (error) {
    console.error('Error notifying admins:', error);
  }
}

/**
 * Get user notifications
 */
async function getUserNotifications(userId, unreadOnly = false) {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    query = query.order('created_at', { ascending: false });

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Failed to fetch notifications:', error);
      return [];
    }

    return notifications;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

/**
 * Mark notification as read
 */
async function markNotificationAsRead(notificationId, userId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 */
async function markAllNotificationsAsRead(userId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Failed to mark all notifications as read:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
}

export {
  createNotification,
  notifyTransactionParties,
  notifyAdmins,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  NOTIFICATION_TYPES,
};
