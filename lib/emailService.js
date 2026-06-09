/**
 * Email Service
 * Verification & transactional mail bypass Supabase Auth SMTP (rate-limited).
 * Providers: Gmail SMTP + Mailjet API — tries both with configurable order.
 */

import nodemailer from 'nodemailer';

let gmailTransporter = null;

const initGmailTransporter = () => {
  if (gmailTransporter) return gmailTransporter;

  const gmailUser = process.env.GMAIL_APP_EMAIL;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPassword) {
    console.warn('[email] Gmail credentials not configured. Mailjet backup will be used if configured.');
    return null;
  }

  gmailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPassword,
    },
  });

  return gmailTransporter;
};

function getDefaultFromEmail() {
  return process.env.MAILJET_FROM_EMAIL || process.env.GMAIL_APP_EMAIL || 'noreply@safehands.local';
}

function getDefaultFromName() {
  return process.env.MAILJET_FROM_NAME || 'Safe Hands Escrow';
}

/** @returns {('gmail'|'mailjet')[]} */
function getEmailProviderOrder() {
  const primary = String(process.env.EMAIL_PRIMARY || 'gmail').toLowerCase();
  if (primary === 'mailjet') return ['mailjet', 'gmail'];
  return ['gmail', 'mailjet'];
}

/**
 * Send via Mailjet REST API.
 * @param {{ to: string; subject: string; html: string; text?: string }} params
 */
async function sendViaMailjet(params) {
  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;
  const fromEmail = getDefaultFromEmail();
  const fromName = getDefaultFromName();

  if (!apiKey || !secretKey) {
    return { success: false, error: 'Mailjet credentials not configured' };
  }

  if (!fromEmail || fromEmail === 'noreply@safehands.local') {
    return { success: false, error: 'MAILJET_FROM_EMAIL or GMAIL_APP_EMAIL required for Mailjet sender' };
  }

  try {
    const auth = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');
    const response = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: fromEmail, Name: fromName },
            To: [{ Email: params.to }],
            Subject: params.subject,
            HTMLPart: params.html,
            TextPart: params.text || params.subject,
          },
        ],
      }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg =
        body?.Messages?.[0]?.Errors?.[0]?.ErrorMessage ||
        body?.ErrorMessage ||
        `Mailjet HTTP ${response.status}`;
      return { success: false, error: errMsg };
    }

    const messageId = body?.Messages?.[0]?.To?.[0]?.MessageID || body?.Messages?.[0]?.MessageID;
    console.log('[email] Sent via Mailjet:', messageId || params.to);
    return { success: true, messageId: String(messageId || ''), service: 'mailjet' };
  } catch (error) {
    return { success: false, error: error.message || 'Mailjet send failed' };
  }
}

async function sendViaGmail(params) {
  const transporter = initGmailTransporter();
  if (!transporter) {
    return { success: false, error: 'Gmail credentials not configured' };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${getDefaultFromName()}" <${process.env.GMAIL_APP_EMAIL}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text || params.subject,
    });
    console.log('[email] Sent via Gmail:', info.messageId);
    return { success: true, messageId: info.messageId, service: 'gmail' };
  } catch (error) {
    return { success: false, error: error.message || 'Gmail send failed' };
  }
}

const sendByProvider = {
  gmail: sendViaGmail,
  mailjet: sendViaMailjet,
};

/**
 * Send email using Gmail + Mailjet with automatic fallback.
 * Set EMAIL_PRIMARY=mailjet to prefer Mailjet when Gmail is rate-limited.
 */
export async function sendEmail({ to, subject, html, text }) {
  try {
    if (!to || !subject || !html) {
      throw new Error('Missing required email fields: to, subject, html');
    }

    console.log(`[email] Sending to: ${to}`);

    const order = getEmailProviderOrder();
    /** @type {string[]} */
    const errors = [];

    for (const provider of order) {
      const send = sendByProvider[provider];
      if (!send) continue;

      const result = await send({ to, subject, html, text });
      if (result.success) return result;

      errors.push(`${provider}: ${result.error}`);
      console.warn(`[email] ${provider} failed:`, result.error);
    }

    throw new Error(errors.join(' | ') || 'No email service available');
  } catch (error) {
    console.error('[email] Send failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send email verification link
 * @param {string} email - User email
 * @param {string} userName - User name
 * @param {string} verificationLink - Full verification link with token
 * @returns {Promise<Object>} Result
 */
export async function sendVerificationEmail(email, userName, verificationLink) {
  const subject = 'Verify Your Email - Safe Hands Escrow';
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(to right, #2563eb, #3b82f6); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .button { background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
          .warning { background: #fef3c7; padding: 10px; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Safe Hands Escrow</h1>
          </div>
          <div class="content">
            <p>Hi ${userName || 'there'},</p>
            
            <p>Thank you for signing up! To complete your registration, please verify your email address by clicking the button below:</p>
            
            <a href="${verificationLink}" class="button">Verify Email Address</a>
            
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 4px;">${verificationLink}</p>
            
            <div class="warning">
              <strong>Note:</strong> This link will expire in 24 hours. If you did not create this account, please ignore this email.
            </div>
            
            <p>If you have any questions, please don't hesitate to contact our support team.</p>
            
            <p>Best regards,<br/>Safe Hands Escrow Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Safe Hands Escrow. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `Welcome to Safe Hands Escrow!\n\nPlease verify your email by visiting this link:\n\n${verificationLink}\n\nThis link expires in 24 hours.`;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}

/**
 * Send password reset link
 * @param {string} email - User email
 * @param {string} userName - User name
 * @param {string} resetLink - Full reset link with token
 * @returns {Promise<Object>} Result
 */
export async function sendPasswordResetEmail(email, userName, resetLink) {
  const subject = 'Reset Your Password - Safe Hands Escrow';
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(to right, #2563eb, #3b82f6); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .button { background: #d97706; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
          .warning { background: #fee2e2; padding: 10px; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi ${userName || 'there'},</p>
            
            <p>We received a request to reset your Safe Hands Escrow password. Click the button below to create a new password:</p>
            
            <a href="${resetLink}" class="button">Reset Password</a>
            
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 4px;">${resetLink}</p>
            
            <div class="warning">
              <strong>Security Notice:</strong> This link will expire in 24 hours. If you did not request this password reset, please ignore this email and your password will remain unchanged.
            </div>
            
            <p>For security reasons, never share this link with anyone.</p>
            
            <p>Best regards,<br/>Safe Hands Escrow Security Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Safe Hands Escrow. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `Password Reset Request\n\nClick this link to reset your password:\n\n${resetLink}\n\nThis link expires in 24 hours.\n\nIf you didn't request this, ignore this email.`;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}

/**
 * Send welcome email after email verification
 * @param {string} email - User email
 * @param {string} userName - User name
 * @returns {Promise<Object>} Result
 */
export async function sendWelcomeEmail(email, userName) {
  const subject = 'Welcome to Safe Hands Escrow!';
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(to right, #2563eb, #3b82f6); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .feature { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #2563eb; border-radius: 4px; }
          .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome, ${userName || 'Friend'}!</h1>
          </div>
          <div class="content">
            <p>Your email has been verified and your account is now active. Welcome to Safe Hands Escrow!</p>
            
            <h2>Getting Started</h2>
            
            <div class="feature">
              <strong>📦 Create Transactions</strong><br/>
              Post items you want to sell or create escrow transactions for items you want to buy.
            </div>
            
            <div class="feature">
              <strong>💳 Secure Payments</strong><br/>
              All payments are processed through M-Pesa with full transaction protection.
            </div>
            
            <div class="feature">
              <strong>🛡️ Dispute Resolution</strong><br/>
              Our team is here to mediate if any issues arise during a transaction.
            </div>
            
            <p>You can now log in to your account and start using Safe Hands Escrow.</p>
            
            <p>Happy trading!<br/>Safe Hands Escrow Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Safe Hands Escrow. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `Welcome to Safe Hands Escrow!\n\nYour account is now active. You can log in and start using our platform.\n\nHappy trading!`;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}

export async function sendSellerInvitationEmail(
  email,
  buyerName,
  invitationLink,
  amount,
  description,
) {
  const subject = 'You were invited to complete an escrow sale';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(to right, #0f766e, #14b8a6); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .button { background: #0f766e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>Escrow Invitation</h1></div>
          <div class="content">
            <p>Hello,</p>
            <p><strong>${buyerName || 'A buyer'}</strong> invited you to join Safe Hands and review a transaction request.</p>
            <p><strong>Amount:</strong> KES ${Number(amount || 0).toLocaleString()}</p>
            <p><strong>Description:</strong> ${description || 'N/A'}</p>
            <a href="${invitationLink}" class="button">Create Account & Review</a>
            <p>If the button doesn't work, open this link:</p>
            <p style="word-break: break-all;">${invitationLink}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `You were invited to complete an escrow sale.\nAmount: KES ${amount}\nDescription: ${description}\nJoin here: ${invitationLink}`;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}

export default {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendSellerInvitationEmail,
};
