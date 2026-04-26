/**
 * Utility Functions for Safe Hands Escrow
 */

/**
 * Format currency value to KES format
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount) {
  if (!amount) return 'KES 0.00';
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date to readable format
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format phone number to standard format
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
export function formatPhone(phone) {
  if (!phone) return '';
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Handle Kenyan phone numbers
  if (cleaned.length === 10 && cleaned.startsWith('7')) {
    return `254${cleaned}`;
  }
  if (cleaned.length === 9 && cleaned.startsWith('07')) {
    return `254${cleaned.substring(1)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('254')) {
    return cleaned;
  }
  
  return phone;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format (Kenyan)
 * @param {string} phone - Phone to validate
 * @returns {boolean} True if valid
 */
export function isValidPhone(phone) {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  // Valid if 10 digits (07...) or 12 digits (254...)
  return (cleaned.length === 10 && cleaned.startsWith('7')) || 
         (cleaned.length === 12 && cleaned.startsWith('254'));
}

/**
 * Validate Kenyan ID number
 * @param {string} idNumber - ID number to validate
 * @returns {boolean} True if valid format
 */
export function isValidKenyanID(idNumber) {
  if (!idNumber) return false;
  const cleaned = idNumber.replace(/\D/g, '');
  return cleaned.length === 8;
}

/**
 * Generate transaction ID
 * @returns {string} Unique transaction ID
 */
export function generateTransactionID() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${timestamp}-${random}`;
}

/**
 * Get transaction status badge color
 * @param {string} status - Transaction status
 * @returns {string} Tailwind color class
 */
export function getStatusColor(status) {
  const colors = {
    initiated: 'bg-yellow-100 text-yellow-800',
    escrow: 'bg-blue-100 text-blue-800',
    delivered: 'bg-purple-100 text-purple-800',
    released: 'bg-green-100 text-green-800',
    disputed: 'bg-red-100 text-red-800',
    refunded: 'bg-orange-100 text-orange-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || colors.initiated;
}

/**
 * Get dispute status badge color
 * @param {string} status - Dispute status
 * @returns {string} Tailwind color class
 */
export function getDisputeStatusColor(status) {
  const colors = {
    open: 'bg-red-100 text-red-800',
    in_review: 'bg-yellow-100 text-yellow-800',
    awaiting_response: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || colors.open;
}

/**
 * Get user role display name
 * @param {string} role - User role
 * @returns {string} Display name
 */
export function getRoleDisplayName(role) {
  const names = {
    buyer: 'Buyer',
    seller: 'Seller',
    admin: 'Administrator',
  };
  return names[role] || role;
}

/**
 * Get KYC status display name
 * @param {string} status - KYC status
 * @returns {string} Display name
 */
export function getKYCStatusName(status) {
  const names = {
    pending: 'Pending Verification',
    approved: 'Verified',
    rejected: 'Verification Failed',
  };
  return names[status] || status;
}

/**
 * Calculate days remaining until auto-release
 * @param {Date|string} releaseDate - Auto-release date
 * @returns {number} Days remaining
 */
export function daysUntilAutoRelease(releaseDate) {
  if (!releaseDate) return null;
  const today = new Date();
  const release = new Date(releaseDate);
  const diff = release - today;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Truncate string to specified length
 * @param {string} str - String to truncate
 * @param {number} length - Max length
 * @returns {string} Truncated string
 */
export function truncateString(str, length = 50) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

/**
 * Parse error message from API response
 * @param {Error|Object} error - Error object
 * @returns {string} User-friendly error message
 */
export function parseErrorMessage(error) {
  if (!error) return 'An unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error.message) return error.message;
  
  if (error.error_description) return error.error_description;
  
  if (error.data?.message) return error.data.message;
  
  return 'An unknown error occurred';
}

/**
 * Merge class names conditionally (simple utility)
 * @param {...any} classes - Classes to merge
 * @returns {string} Merged class string
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Delay execution for specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
export async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate amount (KES)
 * @param {number|string} amount - Amount to validate
 * @returns {Object} {isValid, amount, error}
 */
export function validateAmount(amount) {
  const numAmount = parseFloat(amount);
  
  if (isNaN(numAmount)) {
    return { isValid: false, amount: null, error: 'Amount must be a valid number' };
  }
  
  if (numAmount < 1) {
    return { isValid: false, amount: null, error: 'Amount must be at least KES 1' };
  }
  
  if (numAmount > 500000) {
    return { isValid: false, amount: null, error: 'Amount cannot exceed KES 500,000 per transaction' };
  }
  
  return { isValid: true, amount: numAmount, error: null };
}
