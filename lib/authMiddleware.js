/**
 * Authentication Middleware for API Routes
 * Handles JWT validation, user verification, and role-based access control
 */

import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabaseClient.js';

// Secret key for JWT verification
const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET || 'your-secret-key');

/**
 * Get auth token from cookies
 * @returns {string|null} Auth token or null
 */
export async function getAuthToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    return token || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Promise<Object|null>} Decoded token or null if invalid
 */
export async function verifyToken(token) {
  if (!token) return null;
  
  try {
    const verified = await jwtVerify(token, secret);
    return verified.payload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Get current user from request
 * @param {Request} request - Next.js request object
 * @returns {Promise<Object|null>} User object or null
 */
export async function getCurrentUserFromRequest(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return null;
    }
    
    const payload = await verifyToken(token);
    if (!payload) return null;
    
    // Get user from Supabase
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', payload.sub)
      .single();
    
    if (error || !user) return null;
    
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Middleware to require authentication
 * @param {Function} handler - Route handler
 * @returns {Function} Wrapped handler
 */
export function requireAuth(handler) {
  return async (request, context) => {
    try {
      const user = await getCurrentUserFromRequest(request);
      
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Attach user to request
      request.user = user;
      
      return handler(request, context);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}

/**
 * Middleware to require specific role
 * @param {string[]} allowedRoles - Array of allowed roles
 * @param {Function} handler - Route handler
 * @returns {Function} Wrapped handler
 */
export function requireRole(allowedRoles, handler) {
  return async (request, context) => {
    try {
      const user = await getCurrentUserFromRequest(request);
      
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      if (!allowedRoles.includes(user.role)) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Insufficient permissions' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Attach user to request
      request.user = user;
      
      return handler(request, context);
    } catch (error) {
      console.error('Role middleware error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}

/**
 * Validate request body against schema
 * @param {Request} request - Request object
 * @param {Object} schema - Zod schema for validation
 * @returns {Promise<Object>} {valid, data, errors}
 */
export async function validateRequestBody(request, schema) {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    
    if (!result.success) {
      return {
        valid: false,
        data: null,
        errors: result.error.flatten().fieldErrors,
      };
    }
    
    return {
      valid: true,
      data: result.data,
      errors: null,
    };
  } catch (error) {
    return {
      valid: false,
      data: null,
      errors: { body: ['Invalid JSON'] },
    };
  }
}

/**
 * Create error response
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Response} JSON error response
 */
export function errorResponse(message, status = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Create success response
 * @param {any} data - Response data
 * @param {number} status - HTTP status code
 * @returns {Response} JSON success response
 */
export function successResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Get request body safely
 * @param {Request} request - Request object
 * @returns {Promise<Object>} Parsed JSON or empty object
 */
export async function getRequestBody(request) {
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
}
