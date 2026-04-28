'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { validateLoginForm } from '@/lib/validation';

// Session duration for "remember me" - 1 week in seconds
const REMEMBER_ME_DURATION = 7 * 24 * 60 * 60; // 604800 seconds

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  // Pre-fill email if coming from signup
  useEffect(() => {
    const email = searchParams.get('email');
    if (email) {
      setFormData((prev) => ({
        ...prev,
        email: decodeURIComponent(email),
      }));
      setSuccessMessage(
        'Account created successfully! Please login with your credentials.',
      );
    }
  }, [searchParams]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validate form
    const validationErrors = validateLoginForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);

    try {
      console.log('[v0] Attempting login for:', formData.email);

      // Set up session persistence based on "remember me"
      if (formData.rememberMe) {
        // Set session to persist for 1 week
        const { error: sessionError } = await supabase.auth.setSession({
          expires_in: REMEMBER_ME_DURATION,
        });
        if (sessionError) {
          console.warn(
            '[v0] Could not set session duration:',
            sessionError.message,
          );
        }
      }

      const { data: authData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

      if (signInError) {
        console.error('[v0] Login failed:', signInError.message);

        if (signInError.message.includes('Invalid login credentials')) {
          setErrors({
            form: 'Invalid email or password. Please check and try again.',
          });
        } else if (
          signInError.message.includes('Email not confirmed') ||
          signInError.message.includes('email not confirmed')
        ) {
          setErrors({
            form: 'Please verify your email address before logging in. Check your inbox for the verification link.',
          });
        } else if (signInError.message.includes('Invalid Refresh Token')) {
          setErrors({
            form: 'Your session has expired. Please login again.',
          });
        } else {
          setErrors({
            form: signInError.message,
          });
        }
        return;
      }

      // Check if email is verified
      if (authData.user && !authData.user.email_confirmed_at) {
        console.warn('[v0] Email not verified for user:', authData.user.id);
        setErrors({
          form: 'Please verify your email address before logging in. Check your inbox for the verification link.',
        });
        // Sign out since email is not verified
        await supabase.auth.signOut();
        return;
      }

      // Successful login
      console.log('[v0] Login successful for:', authData.user.email);
      setSuccessMessage('Login successful! Redirecting...');

      // Get user profile to determine dashboard
      if (authData.user) {
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        if (profileError) {
          console.error(
            '[v0] Error fetching user profile:',
            profileError.message,
          );
          setErrors({
            form: 'Error loading user profile. Please contact support.',
          });
          return;
        }

        // Determine redirect based on role
        let redirectPath = '/dashboard';
        if (userProfile?.role === 'seller') {
          redirectPath = '/dashboard/seller';
        } else if (userProfile?.role === 'buyer_seller') {
          redirectPath = '/dashboard'; // Could go to a unified dashboard
        } else if (userProfile?.role === 'admin') {
          redirectPath = '/dashboard/admin';
        } else {
          redirectPath = '/dashboard/buyer';
        }

        console.log(
          '[v0] Redirecting to:',
          redirectPath,
          'for role:',
          userProfile?.role,
        );

        setTimeout(() => {
          router.push(redirectPath);
        }, 1500);
      }
    } catch (error) {
      console.error('[v0] Login error:', error);
      setErrors({
        form: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4">
            S
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-600 mt-2">Login to your Safe Hands account</p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">{successMessage}</p>
          </div>
        )}

        {/* Form Errors */}
        {errors.form && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{errors.form}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="you@example.com"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-gray-900"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          {/* Remember Me */}
          <div className="flex items-center">
            <input
              type="checkbox"
              name="rememberMe"
              id="rememberMe"
              checked={formData.rememberMe}
              onChange={handleInputChange}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-700">
              Remember me
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Forgot Password Link */}
        <div className="text-center mt-4">
          <Link
            href="/auth/forgot-password"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Forgot your password?
          </Link>
        </div>

        {/* Signup Link */}
        <p className="text-center text-gray-600 text-sm mt-6">
          Don&apos;t have an account?{' '}
          <Link
            href="/auth/signup"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Sign up here
          </Link>
        </p>
      </div>
    </div>
  );
}
