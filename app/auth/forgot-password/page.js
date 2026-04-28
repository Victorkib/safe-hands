'use client';

import { useState } from 'react';
import Link from 'next/link';
import { validateEmail } from '@/lib/validation.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validate email
    if (!email) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      console.log('[v0] Requesting password reset');

      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send reset email');
        return;
      }

      console.log('[v0] Password reset email sent');
      setSuccess(true);
      setEmail('');
    } catch (err) {
      console.error('[v0] Forgot password error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4">
            🔐
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Reset Password</h1>
          <p className="text-gray-600 mt-2">We&apos;ll send you a link to reset your password</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm font-medium mb-2">Email Sent!</p>
            <p className="text-green-700 text-sm">
              A password reset link has been sent to your email. Check your inbox and follow the instructions.
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              disabled={loading || success}
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        {/* Information Box */}
        {!success && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-xs">
              <strong>How it works:</strong> We&apos;ll send you an email with a secure link to reset your password. The link expires in 24 hours.
            </p>
          </div>
        )}

        {/* Links */}
        <div className="mt-8 space-y-3 text-center">
          <Link
            href="/auth/login"
            className="block text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Back to Login
          </Link>
          <Link
            href="/auth/signup"
            className="block text-gray-600 hover:text-gray-700 text-sm"
          >
            Don&apos;t have an account? Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
