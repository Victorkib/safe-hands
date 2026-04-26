/**
 * M-Pesa Daraja API Client
 * Handles communication with Safaricom's M-Pesa API
 */

import axios from 'axios';

const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL;

// M-Pesa API endpoints
const SANDBOX_URL = 'https://sandbox.safaricom.co.ke';
const PRODUCTION_URL = 'https://api.safaricom.co.ke';

// Determine if we're in sandbox or production
const IS_PRODUCTION = process.env.NODE_ENV === 'production' && process.env.MPESA_ENVIRONMENT === 'production';
const BASE_URL = IS_PRODUCTION ? PRODUCTION_URL : SANDBOX_URL;

class MPesaClient {
  constructor() {
    this.baseURL = BASE_URL;
    this.consumerKey = MPESA_CONSUMER_KEY;
    this.consumerSecret = MPESA_CONSUMER_SECRET;
    this.callbackURL = MPESA_CALLBACK_URL;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get access token from M-Pesa
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    try {
      // Return cached token if still valid
      if (this.accessToken && this.tokenExpiry > Date.now()) {
        return this.accessToken;
      }

      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      
      const response = await axios.get(
        `${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('Error getting M-Pesa access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with M-Pesa');
    }
  }

  /**
   * Convert phone number to proper format for M-Pesa
   * @param {string} phone - Phone number
   * @returns {string} Formatted phone number
   */
  formatPhoneNumber(phone) {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Convert to 254 format if needed
    if (cleaned.length === 10 && cleaned.startsWith('7')) {
      return `254${cleaned}`;
    }
    if (cleaned.length === 9 && cleaned.startsWith('07')) {
      return `254${cleaned.substring(1)}`;
    }
    
    return cleaned;
  }

  /**
   * Initiate STK Push (M-Pesa prompt on phone)
   * @param {Object} params - Payment parameters
   * @param {string} params.phoneNumber - Customer phone number
   * @param {number} params.amount - Amount in KES
   * @param {string} params.accountReference - Account reference (e.g., transaction ID)
   * @param {string} params.transactionDesc - Transaction description
   * @returns {Promise<Object>} Response from M-Pesa
   */
  async initiateSTKPush(params) {
    try {
      const { phoneNumber, amount, accountReference, transactionDesc } = params;

      if (!phoneNumber || !amount || !accountReference) {
        throw new Error('Missing required parameters: phoneNumber, amount, accountReference');
      }

      const token = await this.getAccessToken();
      const timestamp = this.getTimestamp();
      const password = this.generatePassword(timestamp);
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const response = await axios.post(
        `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: process.env.MPESA_SHORT_CODE || '174379',
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: Math.floor(amount),
          PartyA: formattedPhone,
          PartyB: process.env.MPESA_SHORT_CODE || '174379',
          PhoneNumber: formattedPhone,
          CallBackURL: this.callbackURL,
          AccountReference: accountReference,
          TransactionDesc: transactionDesc || 'Safe Hands Escrow Payment',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return {
        success: true,
        data: response.data,
        message: 'STK push initiated successfully',
      };
    } catch (error) {
      console.error('STK Push error:', error.response?.data || error.message);
      return {
        success: false,
        data: null,
        error: error.response?.data?.errorMessage || error.message,
      };
    }
  }

  /**
   * Query STK Push status
   * @param {string} checkoutRequestID - Checkout request ID from initiate response
   * @returns {Promise<Object>} Status response
   */
  async querySTKPushStatus(checkoutRequestID) {
    try {
      if (!checkoutRequestID) {
        throw new Error('Missing checkoutRequestID');
      }

      const token = await this.getAccessToken();
      const timestamp = this.getTimestamp();
      const password = this.generatePassword(timestamp);

      const response = await axios.post(
        `${this.baseURL}/mpesa/stkpushquery/v1/query`,
        {
          BusinessShortCode: process.env.MPESA_SHORT_CODE || '174379',
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestID,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('STK Status query error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || error.message,
      };
    }
  }

  /**
   * B2C - Business to Customer payment
   * @param {Object} params - Payment parameters
   * @param {string} params.phoneNumber - Customer phone number
   * @param {number} params.amount - Amount in KES
   * @param {string} params.remarks - Payment remarks
   * @returns {Promise<Object>} Response from M-Pesa
   */
  async initiateB2C(params) {
    try {
      const { phoneNumber, amount, remarks } = params;

      if (!phoneNumber || !amount) {
        throw new Error('Missing required parameters: phoneNumber, amount');
      }

      const token = await this.getAccessToken();
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const response = await axios.post(
        `${this.baseURL}/mpesa/b2c/v3/paymentrequest`,
        {
          OriginatorConversationID: this.generateConversationID(),
          InitiatorName: process.env.MPESA_INITIATOR_NAME || 'SafeHands',
          SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL || '',
          CommandID: 'BusinessPayment',
          Amount: Math.floor(amount),
          PartyA: process.env.MPESA_SHORT_CODE || '174379',
          PartyB: formattedPhone,
          Remarks: remarks || 'Escrow fund release',
          QueueTimeOutURL: this.callbackURL,
          ResultURL: this.callbackURL,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return {
        success: true,
        data: response.data,
        message: 'B2C payment initiated',
      };
    } catch (error) {
      console.error('B2C payment error:', error.response?.data || error.message);
      return {
        success: false,
        data: null,
        error: error.response?.data?.errorMessage || error.message,
      };
    }
  }

  /**
   * Generate timestamp in format: YYYYMMDDHHmmss
   * @returns {string} Timestamp
   */
  getTimestamp() {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');
  }

  /**
   * Generate M-Pesa password
   * @param {string} timestamp - Timestamp
   * @returns {string} Password (base64 encoded)
   */
  generatePassword(timestamp) {
    const businessShortCode = process.env.MPESA_SHORT_CODE || '174379';
    const passkey = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd1a503b91';
    const concatenated = businessShortCode + passkey + timestamp;
    
    const buffer = Buffer.from(concatenated, 'utf8');
    return buffer.toString('base64');
  }

  /**
   * Generate unique conversation ID
   * @returns {string} Conversation ID
   */
  generateConversationID() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Validate M-Pesa callback signature
   * @param {string} signature - Callback signature
   * @param {Object} data - Callback data
   * @returns {boolean} True if signature is valid
   */
  validateCallbackSignature(signature, data) {
    // TODO: Implement signature validation
    // This requires M-Pesa's public key for signature verification
    return true; // Placeholder
  }
}

// Export singleton instance
export const mpesaClient = new MPesaClient();

export default mpesaClient;
