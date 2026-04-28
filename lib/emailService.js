/**
 * Email Service
 * Handles sending verification emails and password reset emails
 * Primary: Supabase built-in email
 * Backup: Gmail SMTP via nodemailer
 */

import nodemailer from 'nodemailer';
import { supabase } from './supabaseClient.js';

// Initialize Gmail transporter (backup)
let gmailTransporter = null;

const initGmailTransporter = () => {
  if (gmailTransporter) return gmailTransporter;

  const gmailUser = process.env.GMAIL_APP_EMAIL;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPassword) {
    console.warn('[v0] Gmail credentials not configured. Only Supabase email will be available.');
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

/**
 * Send email using primary service (Supabase) with Gmail fallback
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.html - Email HTML content
 * @param {string} params.text - Email plain text (fallback)
 * @returns {Promise<Object>} Result with success/error
 */
export async function sendEmail({ to, subject, html, text }) {
  try {
    // Validate email
    if (!to || !subject || !html) {
      throw new Error('Missing required email fields: to, subject, html');
    }

    console.log(`[v0] Attempting to send email to: ${to}`);

    // Try Supabase first (primary method)
    try {
      console.log('[v0] Trying Supabase email service...');
      
      // Note: Supabase built-in email is handled automatically when using auth.signUp
      // For custom emails, we use Gmail as primary and this is a fallback mechanism
      // In production, you might use SendGrid or another service

      // For now, we'll skip Supabase and use Gmail directly
      // Supabase email is limited and auto-handled by auth
    } catch (supabaseError) {
      console.warn('[v0] Supabase email failed:', supabaseError.message);
    }

    // Try Gmail (primary for custom emails)
    const transporter = initGmailTransporter();
    if (transporter) {
      console.log('[v0] Trying Gmail email service...');
      
      const info = await transporter.sendMail({
        from: process.env.GMAIL_APP_EMAIL,
        to,
        subject,
        html,
        text: text || subject,
      });

      console.log('[v0] Email sent successfully via Gmail:', info.messageId);
      return {
        success: true,
        messageId: info.messageId,
        service: 'gmail',
      };
    }

    throw new Error('No email service available. Please configure Gmail or Supabase.');
  } catch (error) {
    console.error('[v0] Email service error:', error.message);
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

export default {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
