'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { validateLoginForm } from '@/lib/validation';

// Session duration for "remember me" - 1 week in seconds
const REMEMBER_ME_DURATION = 7 * 24 * 60 * 60; // 604800 seconds

export default function LoginFormContent() {
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
    <div className="w-full max-w-md">
      {/* Card Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
            <div className="w-6 h-6 bg-blue-600 rounded text-white flex items-center justify-center font-bold text-sm">
              SH
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-600 text-sm mt-1">Sign in to your Safe Hands account</p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
            <span className="text-green-600 text-lg">✓</span>
            <p className="text-green-700 text-sm flex-1">{successMessage}</p>
          </div>
        )}

        {/* Form Errors */}
        {errors.form && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <span className="text-red-600 text-lg">⚠</span>
            <p className="text-red-700 text-sm flex-1">{errors.form}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="name@company.com"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
              }`}
              disabled={loading}
            />
            {errors.email && (
              <p className="text-red-600 text-xs mt-1.5 flex items-center gap-1">
                <span>⚠</span> {errors.email}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-900">
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-blue-600 hover:text-blue-700 text-xs font-medium transition"
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-11 ${
                  errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                }`}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900 text-sm transition"
                disabled={loading}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-600 text-xs mt-1.5 flex items-center gap-1">
                <span>⚠</span> {errors.password}
              </p>
            )}
          </div>

          {/* Remember Me Checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="rememberMe"
              checked={formData.rememberMe}
              onChange={handleInputChange}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <span className="text-sm text-gray-700 font-medium">Keep me signed in</span>
          </label>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed mt-6"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-xs text-gray-600 font-medium">NEW USER?</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        {/* Signup CTA */}
        <Link
          href="/auth/signup"
          className="w-full block text-center px-4 py-2.5 border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
        >
          Create Account
        </Link>
      </div>

      {/* Trust Indicators */}
      <div className="mt-6 flex items-center justify-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <span>🔒</span> Secure Login
        </div>
        <span>•</span>
        <div className="flex items-center gap-1">
          <span>📱</span> M-Pesa Enabled
        </div>
      </div>
    </div>
  );
}
