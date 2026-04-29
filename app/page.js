'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PublicLayout from '@/components/layout/PublicLayout';
import { supabase } from '@/lib/supabaseClient';

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);

  // Check if user is logged in and redirect to dashboard
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setIsAuthenticated(true);

          // Get user role from metadata
          const role = session.user.user_metadata?.role || 'buyer';
          setUserRole(role);

          // Redirect to appropriate dashboard
          const dashboardPath =
            role === 'buyer_seller' ? '/dashboard/buyer' : `/dashboard/${role}`;
          router.push(dashboardPath);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // If user is authenticated, don't render the page (they'll be redirected)
  if (isAuthenticated) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Redirecting to dashboard...</p>
          </div>
        </div>
      </PublicLayout>
    );
  }
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="py-24 text-center">
        <div className="max-w-4xl mx-auto px-4 space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
              Secure P2P Escrow<br />Made Simple
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Safe Hands Escrow provides trusted protection for buyers and sellers across Kenya. Transact with confidence using our secure escrow service integrated with M-Pesa.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold"
            >
              Start Trading Now
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center justify-center px-8 py-3.5 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg transition font-semibold"
            >
              Learn More
            </Link>
          </div>

          <p className="text-sm text-gray-500 pt-4">
            Join thousands of Kenyan traders using Safe Hands for secure transactions
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="max-w-6xl mx-auto px-4 space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold text-gray-900">
              Why Choose Safe Hands?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Built with trust, security, and simplicity for Kenyan traders
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white border border-gray-200 p-8 rounded-xl shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 20c-3.9-1.14-7-5.29-7-9v-4.82l7-3.18 7 3.18V12c0 3.71-3.1 7.86-7 9z"/><path d="M10 17l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" fill="currentColor"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Secure Protection
              </h3>
              <p className="text-gray-600 text-sm">
                Your funds are held securely in escrow until both parties confirm transaction completion. No disputes, no lost money.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white border border-gray-200 p-8 rounded-xl shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                M-Pesa Integrated
              </h3>
              <p className="text-gray-600 text-sm">
                Direct integration with M-Pesa Daraja API. Send and receive money instantly with Kenya&apos;s most trusted payment system.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white border border-gray-200 p-8 rounded-xl shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Fair Dispute Resolution
              </h3>
              <p className="text-gray-600 text-sm">
                Expert admins review disputes fairly. Our transparent process ensures both buyers and sellers are treated equally.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white border border-gray-200 p-8 rounded-xl shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1C6.48 1 2 5.48 2 11s4.48 10 10 10 10-4.48 10-10S17.52 1 12 1zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Verified Users
              </h3>
              <p className="text-gray-600 text-sm">
                KYC verification ensures only legitimate traders use the platform. Build trust through our user rating system.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white border border-gray-200 p-8 rounded-xl shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Easy to Use
              </h3>
              <p className="text-gray-600 text-sm">
                Simple, intuitive interface. Create a transaction in minutes. Track everything in real-time from your dashboard.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white border border-gray-200 p-8 rounded-xl shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-teal-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Kenya-Focused
              </h3>
              <p className="text-gray-600 text-sm">
                Built for Kenyan traders. Supports KES currency, local phone numbers, and Safaricom M-Pesa exclusively.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            How It Works
          </h2>

          <div className="space-y-8">
            {/* Step 1 */}
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-600 text-white font-bold text-lg">
                  1
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Create Account
                </h3>
                <p className="text-gray-600 mt-2">
                  Sign up as a buyer or seller. Verify your email and phone
                  number to start trading securely.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-600 text-white font-bold text-lg">
                  2
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Create Transaction
                </h3>
                <p className="text-gray-600 mt-2">
                  Buyers create a transaction with seller details and amount.
                  Review the terms before proceeding.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-600 text-white font-bold text-lg">
                  3
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Make Payment
                </h3>
                <p className="text-gray-600 mt-2">
                  Pay via M-Pesa. Funds go into escrow - not directly to the
                  seller. Transaction is now protected.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-600 text-white font-bold text-lg">
                  4
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Confirm Delivery
                </h3>
                <p className="text-gray-600 mt-2">
                  Buyer receives goods and confirms delivery. Seller is notified
                  and can prepare for payout.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-600 text-white font-bold text-lg">
                  5
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Release Funds
                </h3>
                <p className="text-gray-600 mt-2">
                  Funds are released from escrow to seller&apos;s M-Pesa
                  account. Transaction complete!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Trade Safely?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of buyers and sellers who trust Safe Hands Escrow
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="inline-block px-8 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition font-semibold"
            >
              Create Free Account
            </Link>
            <Link
              href="/auth/login"
              className="inline-block px-8 py-3 border-2 border-white text-white rounded-lg hover:bg-white hover:text-blue-600 transition font-semibold"
            >
              Already have an account?
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            <details className="bg-white p-6 rounded-lg shadow cursor-pointer group">
              <summary className="font-bold text-gray-900 flex justify-between items-center">
                Is Safe Hands Escrow safe?
                <span className="text-2xl group-open:rotate-180 transition">
                  +
                </span>
              </summary>
              <p className="text-gray-600 mt-4">
                Yes! Your funds are held in escrow until both parties confirm
                the transaction. We use bank-grade security and integrate
                directly with M-Pesa.
              </p>
            </details>

            <details className="bg-white p-6 rounded-lg shadow cursor-pointer group">
              <summary className="font-bold text-gray-900 flex justify-between items-center">
                What are the transaction fees?
                <span className="text-2xl group-open:rotate-180 transition">
                  +
                </span>
              </summary>
              <p className="text-gray-600 mt-4">
                We charge a small percentage per transaction (details coming
                soon). M-Pesa charges are as per their standard rates.
              </p>
            </details>

            <details className="bg-white p-6 rounded-lg shadow cursor-pointer group">
              <summary className="font-bold text-gray-900 flex justify-between items-center">
                What if there&apos;s a dispute?
                <span className="text-2xl group-open:rotate-180 transition">
                  +
                </span>
              </summary>
              <p className="text-gray-600 mt-4">
                Either party can raise a dispute with evidence. Our admin team
                reviews fairly and makes a resolution. Funds are released
                accordingly.
              </p>
            </details>

            <details className="bg-white p-6 rounded-lg shadow cursor-pointer group">
              <summary className="font-bold text-gray-900 flex justify-between items-center">
                How long does a transaction take?
                <span className="text-2xl group-open:rotate-180 transition">
                  +
                </span>
              </summary>
              <p className="text-gray-600 mt-4">
                Typically 1-3 days. Funds are released to the seller after the
                buyer confirms delivery. Instant if both parties agree.
              </p>
            </details>

            <details className="bg-white p-6 rounded-lg shadow cursor-pointer group">
              <summary className="font-bold text-gray-900 flex justify-between items-center">
                Do I need KYC verification?
                <span className="text-2xl group-open:rotate-180 transition">
                  +
                </span>
              </summary>
              <p className="text-gray-600 mt-4">
                Yes, basic KYC is required. Provide your email, phone number,
                and full name. This protects all users on the platform.
              </p>
            </details>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
