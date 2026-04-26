/**
 * Form Validation Utilities
 * Zod-like validation without external dependencies
 */

// Email validation
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Password validation
export const validatePassword = (password) => {
  return {
    isValid: password.length >= 8,
    length: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
};

// Phone number validation (Kenyan format)
export const validatePhone = (phone) => {
  // Remove spaces and common separators
  const cleaned = phone.replace(/[\s\-()]/g, '');

  // Accept formats: 254xxxxxxxxx, +254xxxxxxxxx, 07xxxxxxxxx, 0xxxxxxxxx
  const phoneRegex = /^(254|\+254|0)([1-9]\d{8})$/;

  return phoneRegex.test(cleaned);
};

// Normalize phone number to 254xxxxxxxxx format
export const normalizePhone = (phone) => {
  let cleaned = phone.replace(/[\s\-()]/g, '');

  if (cleaned.startsWith('+254')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  }

  return cleaned;
};

// Form field validation
export const validateField = (fieldName, value) => {
  const errors = {};

  switch (fieldName) {
    case 'email':
      if (!value) {
        errors.email = 'Email is required';
      } else if (!validateEmail(value)) {
        errors.email = 'Please enter a valid email address';
      }
      break;

    case 'password':
      if (!value) {
        errors.password = 'Password is required';
      } else {
        const passwordCheck = validatePassword(value);
        if (!passwordCheck.isValid) {
          errors.password = 'Password must be at least 8 characters long';
        }
      }
      break;

    case 'confirmPassword':
      if (!value) {
        errors.confirmPassword = 'Please confirm your password';
      }
      break;

    case 'phone':
      if (!value) {
        errors.phone = 'Phone number is required';
      } else if (!validatePhone(value)) {
        errors.phone = 'Please enter a valid Kenyan phone number (07xxxxxxxxx or 254xxxxxxxxx)';
      }
      break;

    case 'name':
      if (!value) {
        errors.name = 'Name is required';
      } else if (value.length < 2) {
        errors.name = 'Name must be at least 2 characters';
      }
      break;

    case 'amount':
      if (!value) {
        errors.amount = 'Amount is required';
      } else if (isNaN(value) || parseFloat(value) <= 0) {
        errors.amount = 'Please enter a valid amount';
      }
      break;

    default:
      break;
  }

  return errors;
};

// Full signup form validation
export const validateSignupForm = (formData) => {
  const errors = {};

  if (!formData.email) {
    errors.email = 'Email is required';
  } else if (!validateEmail(formData.email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (!formData.name) {
    errors.name = 'Full name is required';
  } else if (formData.name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (!formData.phone) {
    errors.phone = 'Phone number is required';
  } else if (!validatePhone(formData.phone)) {
    errors.phone = 'Please enter a valid Kenyan phone number';
  }

  if (!formData.password) {
    errors.password = 'Password is required';
  } else {
    const passwordCheck = validatePassword(formData.password);
    if (!passwordCheck.isValid) {
      errors.password = 'Password must be at least 8 characters';
    }
  }

  if (!formData.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  if (!formData.role) {
    errors.role = 'Please select your role';
  }

  return errors;
};

// Login form validation
export const validateLoginForm = (formData) => {
  const errors = {};

  if (!formData.email) {
    errors.email = 'Email is required';
  } else if (!validateEmail(formData.email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (!formData.password) {
    errors.password = 'Password is required';
  }

  return errors;
};

// Transaction form validation
export const validateTransactionForm = (formData) => {
  const errors = {};

  if (!formData.sellerEmail) {
    errors.sellerEmail = 'Seller email is required';
  } else if (!validateEmail(formData.sellerEmail)) {
    errors.sellerEmail = 'Please enter a valid email address';
  }

  if (!formData.description) {
    errors.description = 'Item description is required';
  } else if (formData.description.length < 5) {
    errors.description = 'Description must be at least 5 characters';
  }

  if (!formData.amount) {
    errors.amount = 'Amount is required';
  } else if (isNaN(formData.amount) || parseFloat(formData.amount) <= 0) {
    errors.amount = 'Please enter a valid amount';
  } else if (parseFloat(formData.amount) > 999999) {
    errors.amount = 'Amount cannot exceed KES 999,999';
  }

  return errors;
};

/**
 * Utility function to get first error message for a field
 * Useful for displaying single errors per field
 */
export const getFieldError = (errors, fieldName) => {
  return errors[fieldName] || null;
};

/**
 * Check if form has any errors
 */
export const hasErrors = (errors) => {
  return Object.values(errors).some((error) => error !== '');
};

/**
 * Format error messages for display
 */
export const formatErrorMessage = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return 'An error occurred';
};
