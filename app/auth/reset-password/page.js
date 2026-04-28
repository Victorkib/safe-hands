'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { validatePassword } from '@/lib/validation.js';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!token) {
      setError('No reset token provided');
      setLoading(false);
      setValidating(false);
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      setValidating(true);
      console.log('[v0] Validating reset token');

      const response = await fetch(`/api/auth/reset-password?token=${token}`);
      const data = await response.json();

      if (!response.ok || !data.valid) {
        setError(data.error || 'Invalid or expired reset link');
        setTokenValid(false);
        setLoading(false);
        return;
      }

      console.log('[v0] Token is valid');
      setTokenValid(true);
      setLoading(false);
    } catch (err) {
      console.error('[v0] Token validation error:', err);
      setError('An error occurred validating your reset link');
      setLoading(false);
    } finally {
      setValidating(false);
    }
  };

  const updatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 25;
    setPasswordStrength(strength);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === 'password') {
      updatePasswordStrength(value);
    }

    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validate form
    if (!formData.password || !formData.confirmPassword) {
      setError('Both password fields are required');
      return;
    }

    // Check password strength
    const passwordCheck = validatePassword(formData.password);
    if (!passwordCheck.isValid) {
      setError('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
      return;
    }

    // Check passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      console.log('[v0] Resetting password');

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        return;
      }

      console.log('[v0] Password reset successful');
      setSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (err) {
      console.error('[v0] Reset password error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 50) return 'bg-red-500';
    if (passwordStrength < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength < 50) return 'Weak';
    if (passwordStrength < 75) return 'Fair';
    return 'Strong';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4">
            🔑
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Create New Password</h1>
          <p className="text-gray-600 mt-2">Enter your new password below</p>
        </div>

        {/* Loading State */}
        {(loading || validating) && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Validating reset link...</p>
          </div>
        )}

        {/* Invalid Token */}
        {!loading && !tokenValid && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 font-medium mb-4">{error}</p>
            <p className="text-gray-600 text-sm mb-4">
              Your reset link is invalid or has expired. Request a new one:
            </p>
            <Link
              href="/auth/forgot-password"
              className="block w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium text-center"
            >
              Request New Reset Link
            </Link>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <p className="text-green-800 font-medium mb-2">Password Reset!</p>
            <p className="text-green-700 text-sm mb-4">
              Your password has been successfully reset. You can now login with your new password.
            </p>
            <p className="text-gray-600 text-xs">Redirecting to login in 2 seconds...</p>
          </div>
        )}

        {/* Reset Form */}
        {!loading && tokenValid && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                disabled={submitting}
              />
              {formData.password && (
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600">Password strength:</span>
                    <span className="text-xs font-medium text-gray-700">
                      {getPasswordStrengthText()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getPasswordStrengthColor()}`}
                      style={{ width: `${passwordStrength}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="••••••••"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                disabled={submitting}
              />
              {formData.password && formData.confirmPassword && (
                <div className="mt-2">
                  {formData.password === formData.confirmPassword ? (
                    <p className="text-xs text-green-600">✓ Passwords match</p>
                  ) : (
                    <p className="text-xs text-red-600">✗ Passwords do not match</p>
                  )}
                </div>
              )}
            </div>

            {/* Password Requirements */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-blue-800 text-xs font-medium mb-2">Password must contain:</p>
              <ul className="text-blue-700 text-xs space-y-1">
                <li className={validatePassword(formData.password).length ? '✓' : '○'}>
                  {' '}
                  At least 8 characters
                </li>
                <li className={validatePassword(formData.password).hasUpperCase ? '✓' : '○'}>
                  {' '}
                  Uppercase letter
                </li>
                <li className={validatePassword(formData.password).hasLowerCase ? '✓' : '○'}>
                  {' '}
                  Lowercase letter
                </li>
                <li className={validatePassword(formData.password).hasNumber ? '✓' : '○'}>
                  {' '}
                  Number
                </li>
                <li className={validatePassword(formData.password).hasSpecialChar ? '✓' : '○'}>
                  {' '}
                  Special character (!@#$%^&*)
                </li>
              </ul>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {submitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        {/* Back to Login */}
        {!loading && (
          <div className="mt-8 text-center">
            <Link
              href="/auth/login"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
