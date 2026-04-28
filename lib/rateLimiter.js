/**
 * Rate Limiting Utility
 * Provides production-ready rate limiting for authentication endpoints
 * Only active in production environment
 */

// In-memory stores for rate limiting (production use should use Redis)
const loginAttempts = new Map();
const signupAttempts = new Map();
const emailAttempts = new Map();

// Rate limit configurations
const RATE_LIMITS = {
  // Login: 5 attempts per 15 minutes per IP
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // Signup: 3 attempts per hour per IP
  signup: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Email operations (password reset, resend verification): 3 per 5 minutes per email
  email: {
    maxAttempts: 3,
    windowMs: 5 * 60 * 1000, // 5 minutes
  },
};

/**
 * Check if request is rate limited
 * @param {string} key - Unique identifier (IP or email)
 * @param {string} type - Type of rate limit (login, signup, email)
 * @returns {Object} { allowed: boolean, retryAfter?: number, remaining: number }
 */
export function checkRateLimit(key, type = 'login') {
  // Only enforce rate limiting in production
  if (process.env.NODE_ENV !== 'production') {
    return { allowed: true, remaining: Infinity };
  }

  const config = RATE_LIMITS[type];
  if (!config) {
    console.warn(`[v0] Unknown rate limit type: ${type}`);
    return { allowed: true, remaining: Infinity };
  }

  const now = Date.now();
  const store =
    type === 'email'
      ? emailAttempts
      : type === 'signup'
        ? signupAttempts
        : loginAttempts;

  // Get existing attempts for this key
  const attempts = store.get(key) || [];

  // Filter to only attempts within the window
  const recentAttempts = attempts.filter(
    (timestamp) => now - timestamp < config.windowMs,
  );

  // Check if limit exceeded
  if (recentAttempts.length >= config.maxAttempts) {
    const oldestAttempt = recentAttempts[0];
    const retryAfter = Math.ceil(
      (config.windowMs - (now - oldestAttempt)) / 1000,
    );

    console.warn(`[v0] Rate limit exceeded for ${type}: ${key}`);

    return {
      allowed: false,
      retryAfter,
      remaining: 0,
    };
  }

  // Record this attempt
  recentAttempts.push(now);
  store.set(key, recentAttempts);

  // Cleanup old entries periodically
  if (store.size > 1000) {
    cleanupOldEntries(store, config.windowMs);
  }

  return {
    allowed: true,
    remaining: config.maxAttempts - recentAttempts.length,
  };
}

/**
 * Record a failed login attempt
 * @param {string} ip - IP address
 * @param {string} email - Email address (optional)
 */
export function recordFailedLogin(ip, email = null) {
  if (process.env.NODE_ENV !== 'production') return;

  const key = email || ip;
  const attempts = loginAttempts.get(key) || [];
  attempts.push(Date.now());
  loginAttempts.set(key, attempts);
}

/**
 * Clear login attempts for a key (e.g., after successful login)
 * @param {string} key - IP or email
 */
export function clearLoginAttempts(key) {
  loginAttempts.delete(key);
}

/**
 * Cleanup old entries from a store
 * @param {Map} store - The store to clean
 * @param {number} windowMs - Window duration in milliseconds
 */
function cleanupOldEntries(store, windowMs) {
  const now = Date.now();
  const cutoff = now - windowMs;

  for (const [key, attempts] of store.entries()) {
    const recentAttempts = attempts.filter((timestamp) => timestamp >= cutoff);
    if (recentAttempts.length === 0) {
      store.delete(key);
    } else {
      store.set(key, recentAttempts);
    }
  }
}

/**
 * Get rate limit headers for response
 * @param {Object} result - Result from checkRateLimit
 * @returns {Object} Headers object
 */
export function getRateLimitHeaders(result) {
  return {
    'X-RateLimit-Limit':
      result.remaining !== Infinity ? String(result.remaining) : 'unlimited',
    'X-RateLimit-Remaining':
      result.remaining !== Infinity
        ? String(Math.max(0, result.remaining - 1))
        : 'unlimited',
    'X-RateLimit-Reset': result.retryAfter
      ? String(Math.floor(Date.now() / 1000) + result.retryAfter)
      : 'N/A',
    ...(result.retryAfter && { 'Retry-After': String(result.retryAfter) }),
  };
}

/**
 * Create a rate limiting middleware for Next.js API routes
 * @param {string} type - Type of rate limit
 * @param {function} getKey - Function to extract key from request
 * @returns {function} Middleware function
 */
export function createRateLimitMiddleware(type, getKey = (req) => req.ip) {
  return async function rateLimitMiddleware(request) {
    const key = getKey(request);
    const result = checkRateLimit(key, type);

    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...getRateLimitHeaders(result),
          },
        },
      );
    }

    return null; // No error, continue
  };
}

export default {
  checkRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
  getRateLimitHeaders,
  createRateLimitMiddleware,
  RATE_LIMITS,
};
