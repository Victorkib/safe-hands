'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    // If no token, show email input form
    if (!token) {
      setLoading(false);
      return;
    }

    // Verify the token
    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('[v0] Verifying email with token');

      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Verification failed');
        setLoading(false);
        return;
      }

      console.log('[v0] Email verified successfully');
      setVerified(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);
    } catch (err) {
      console.error('[v0] Verification error:', err);
      setError('An error occurred during verification. Please try again.');
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    try {
      setResending(true);
      setError('');

      console.log('[v0] Requesting new verification email');

      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to resend email');
        return;
      }

      console.log('[v0] Verification email resent');
      setError('');
      alert(data.message);
    } catch (err) {
      console.error('[v0] Resend error:', err);
      setError('Failed to resend verification email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4">
            ✓
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Verify Your Email</h1>
          <p className="text-gray-600 mt-2">Confirm your email address to activate your account</p>
        </div>

        {/* Loading State */}
        {loading && token && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Verifying your email...</p>
          </div>
        )}

        {/* Success State */}
        {verified && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <p className="text-green-800 font-medium mb-2">Email Verified!</p>
            <p className="text-green-700 text-sm mb-4">
              Your email has been confirmed. You can now login with your credentials.
            </p>
            <p className="text-gray-600 text-xs">Redirecting to login in 3 seconds...</p>
          </div>
        )}

        {/* Error State with Token */}
        {error && token && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 font-medium mb-4">{error}</p>
            <div className="space-y-3">
              <p className="text-gray-600 text-sm">
                If your link has expired, you can request a new one below.
              </p>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <button
                onClick={handleResendEmail}
                disabled={resending}
                className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </button>
            </div>
          </div>
        )}

        {/* Initial State (No Token) */}
        {!token && !loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <p className="text-blue-800 font-medium mb-4">Check Your Email</p>
            <p className="text-gray-600 text-sm mb-4">
              A verification link has been sent to your email address. Click the link in the email to verify your account.
            </p>
            <div className="space-y-3">
              <p className="text-gray-600 text-xs">
                If you don&apos;t see the email, please check your spam folder.
              </p>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <button
                onClick={handleResendEmail}
                disabled={resending}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {resending ? 'Sending...' : 'Resend Email'}
              </button>
            </div>
          </div>
        )}

        {/* Back to Login */}
        <div className="mt-8 text-center">
          <Link
            href="/auth/login"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
