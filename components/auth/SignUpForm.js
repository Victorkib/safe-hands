'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { validateSignupForm, normalizePhone } from '@/lib/validation.js';
import { signupUser } from '@/app/actions/auth.js';

export default function SignUpForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupName, setSignupName] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'buyer',
  });

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
    const validationErrors = validateSignupForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);

    try {
      const normalizedPhone = normalizePhone(formData.phone);

      console.log('[v0] Starting signup process');

      const result = await signupUser({
        email: formData.email,
        name: formData.name,
        phone: normalizedPhone,
        password: formData.password,
        role: formData.role,
      });

      if (!result.success) {
        if (result.error.includes('already registered')) {
          setErrors({
            email: 'This email is already registered. Please login instead.',
          });
        } else {
          setErrors({ form: result.error });
        }
        setLoading(false);
        return;
      }

      console.log('[v0] Signup successful');

      // Show verification modal
      setSignupEmail(result.email);
      setSignupName(result.name);
      setShowVerificationModal(true);

      // Reset form
      setFormData({
        email: '',
        name: '',
        phone: '',
        password: '',
        confirmPassword: '',
        role: 'buyer',
      });
      setPasswordStrength(0);

      if (!result.emailSent && result.emailError) {
        console.warn(
          '[v0] Verification email failed, but account created:',
          result.emailError,
        );
      }
    } catch (error) {
      console.error('[v0] Signup error:', error);
      setErrors({ form: 'An unexpected error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    try {
      setResendLoading(true);

      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ form: data.error || 'Failed to resend email' });
        return;
      }

      alert('Verification email resent! Check your inbox.');
    } catch (error) {
      console.error('[v0] Resend error:', error);
      setErrors({ form: 'Failed to resend verification email' });
    } finally {
      setResendLoading(false);
    }
  };

  const handleGoToVerify = () => {
    router.push('/auth/verify-email');
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

  // Verification Modal
  if (showVerificationModal) {
    return (
      <div className="w-full max-w-md">
        {/* Card Container */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-lg mb-4">
              <span className="text-3xl">✉️</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Check Your Email</h1>
            <p className="text-gray-600 text-sm mt-1">Verification link sent</p>
          </div>

          {/* Email Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <p className="text-gray-700 text-sm mb-3">Verification email sent to:</p>
            <p className="font-semibold text-blue-600 mb-6 break-all">{signupEmail}</p>

            <p className="text-gray-600 text-sm mb-6">
              Click the link in your email to verify your account. The link expires in 24 hours.
            </p>

            {/* Primary Action */}
            <button
              onClick={handleGoToVerify}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors mb-3"
            >
              I&apos;ve Verified My Email
            </button>

            {/* Secondary Action */}
            <button
              onClick={handleResendEmail}
              disabled={resendLoading}
              className="w-full px-4 py-2.5 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></span>
                  Sending...
                </span>
              ) : (
                'Resend Email'
              )}
            </button>
          </div>

          {/* Help Tip */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-amber-700 text-xs flex gap-2">
              <span className="flex-shrink-0">💡</span>
              <span>
                <strong>Tip:</strong> Check your spam or promotions folder if you don&apos;t see the email in 2 minutes.
              </span>
            </p>
          </div>

          {/* Back Link */}
          <p className="text-center">
            <Link
              href="/auth/login"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm transition"
            >
              ← Back to Login
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // Signup Form
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
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-600 text-sm mt-1">Start trading safely on Safe Hands</p>
        </div>

        {/* Form Errors */}
        {errors.form && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <span className="text-red-600 text-lg">⚠</span>
            <p className="text-red-700 text-sm flex-1">{errors.form}</p>
          </div>
        )}

        {/* Signup Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          suppressHydrationWarning
        >
          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Full Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="John Doe"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
              }`}
              disabled={loading}
            />
            {errors.name && (
              <p className="text-red-600 text-xs mt-1.5">⚠ {errors.name}</p>
            )}
          </div>

          {/* Email */}
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
              <p className="text-red-600 text-xs mt-1.5">⚠ {errors.email}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Phone (Kenya)
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="07XX XXXX XX"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
              }`}
              disabled={loading}
            />
            {errors.phone && (
              <p className="text-red-600 text-xs mt-1.5">⚠ {errors.phone}</p>
            )}
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              I am a:
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.role ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
              }`}
              disabled={loading}
            >
              <option value="buyer">Buyer only</option>
              <option value="seller">Seller only</option>
              <option value="buyer_seller">Both Buyer & Seller</option>
            </select>
            {errors.role && (
              <p className="text-red-600 text-xs mt-1.5">⚠ {errors.role}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="••••••••"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
              }`}
              disabled={loading}
            />
            {formData.password && (
              <div className="mt-2.5">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-gray-600 font-medium">
                    Strength: {getPasswordStrengthText()}
                  </span>
                  <span className="text-xs font-semibold">
                    {passwordStrength}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                    style={{ width: `${passwordStrength}%` }}
                  />
                </div>
              </div>
            )}
            {errors.password && (
              <p className="text-red-600 text-xs mt-1.5">⚠ {errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="••••••••"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
              }`}
              disabled={loading}
            />
            {errors.confirmPassword && (
              <p className="text-red-600 text-xs mt-1.5">⚠ {errors.confirmPassword}</p>
            )}
          </div>

          {/* Terms & Conditions */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
            By creating an account, you agree to our <a href="#" className="text-blue-600 hover:underline">Terms</a> and <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
          </div>

          {/* Create Account Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed mt-6"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Creating Account...
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-xs text-gray-600 font-medium">HAVE ACCOUNT?</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        {/* Login CTA */}
        <Link
          href="/auth/login"
          className="w-full block text-center px-4 py-2.5 border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
        >
          Sign In Instead
        </Link>
      </div>

      {/* Trust Indicators */}
      <div className="mt-6 text-center text-xs text-gray-600 space-y-2">
        <p>🔐 Fast & Secure • 📱 Instant M-Pesa Integration</p>
        <p>✓ No hidden fees • ✓ Kenya-based support</p>
      </div>
    </div>
  );
}
