'use client';

import Link from 'next/link';
import Layout from '@/components/shared/Layout';

export default function HomePage() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Secure P2P Escrow Made Simple
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Safe Hands Escrow provides a trusted platform for buyer and seller protection in Kenya. Transact with confidence using our secure escrow service integrated with M-Pesa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              Get Started
            </Link>
            <Link
              href="#features"
              className="inline-block px-8 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition font-semibold"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50 rounded-2xl">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            Why Choose Safe Hands?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-8 rounded-xl shadow hover:shadow-lg transition">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-2xl mb-4">
                🔒
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Secure Protection</h3>
              <p className="text-gray-600">
                Your funds are held securely in escrow until both parties confirm transaction completion. No disputes, no lost money.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-8 rounded-xl shadow hover:shadow-lg transition">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center text-2xl mb-4">
                💰
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">M-Pesa Integrated</h3>
              <p className="text-gray-600">
                Direct integration with M-Pesa Daraja API. Send and receive money instantly with Kenya&apos;s most trusted payment system.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-8 rounded-xl shadow hover:shadow-lg transition">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center text-2xl mb-4">
                ⚖️
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Fair Dispute Resolution</h3>
              <p className="text-gray-600">
                Expert admins review disputes fairly. Our transparent process ensures both buyers and sellers are treated equally.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-8 rounded-xl shadow hover:shadow-lg transition">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-lg flex items-center justify-center text-2xl mb-4">
                ✓
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Verified Users</h3>
              <p className="text-gray-600">
                KYC verification ensures only legitimate traders use the platform. Build trust through our user rating system.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-8 rounded-xl shadow hover:shadow-lg transition">
              <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-lg flex items-center justify-center text-2xl mb-4">
                📱
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Easy to Use</h3>
              <p className="text-gray-600">
                Simple, intuitive interface. Create a transaction in minutes. Track everything in real-time from your dashboard.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-8 rounded-xl shadow hover:shadow-lg transition">
              <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-lg flex items-center justify-center text-2xl mb-4">
                🌍
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Kenya-Focused</h3>
              <p className="text-gray-600">
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
                <h3 className="text-xl font-bold text-gray-900">Create Account</h3>
                <p className="text-gray-600 mt-2">
                  Sign up as a buyer or seller. Verify your email and phone number to start trading securely.
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
                <h3 className="text-xl font-bold text-gray-900">Create Transaction</h3>
                <p className="text-gray-600 mt-2">
                  Buyers create a transaction with seller details and amount. Review the terms before proceeding.
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
                <h3 className="text-xl font-bold text-gray-900">Make Payment</h3>
                <p className="text-gray-600 mt-2">
                  Pay via M-Pesa. Funds go into escrow - not directly to the seller. Transaction is now protected.
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
                <h3 className="text-xl font-bold text-gray-900">Confirm Delivery</h3>
                <p className="text-gray-600 mt-2">
                  Buyer receives goods and confirms delivery. Seller is notified and can prepare for payout.
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
                <h3 className="text-xl font-bold text-gray-900">Release Funds</h3>
                <p className="text-gray-600 mt-2">
                  Funds are released from escrow to seller&apos;s M-Pesa account. Transaction complete!
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
                <span className="text-2xl group-open:rotate-180 transition">+</span>
              </summary>
              <p className="text-gray-600 mt-4">
                Yes! Your funds are held in escrow until both parties confirm the transaction. We use bank-grade security and integrate directly with M-Pesa.
              </p>
            </details>

            <details className="bg-white p-6 rounded-lg shadow cursor-pointer group">
              <summary className="font-bold text-gray-900 flex justify-between items-center">
                What are the transaction fees?
                <span className="text-2xl group-open:rotate-180 transition">+</span>
              </summary>
              <p className="text-gray-600 mt-4">
                We charge a small percentage per transaction (details coming soon). M-Pesa charges are as per their standard rates.
              </p>
            </details>

            <details className="bg-white p-6 rounded-lg shadow cursor-pointer group">
              <summary className="font-bold text-gray-900 flex justify-between items-center">
                What if there&apos;s a dispute?
                <span className="text-2xl group-open:rotate-180 transition">+</span>
              </summary>
              <p className="text-gray-600 mt-4">
                Either party can raise a dispute with evidence. Our admin team reviews fairly and makes a resolution. Funds are released accordingly.
              </p>
            </details>

            <details className="bg-white p-6 rounded-lg shadow cursor-pointer group">
              <summary className="font-bold text-gray-900 flex justify-between items-center">
                How long does a transaction take?
                <span className="text-2xl group-open:rotate-180 transition">+</span>
              </summary>
              <p className="text-gray-600 mt-4">
                Typically 1-3 days. Funds are released to the seller after the buyer confirms delivery. Instant if both parties agree.
              </p>
            </details>

            <details className="bg-white p-6 rounded-lg shadow cursor-pointer group">
              <summary className="font-bold text-gray-900 flex justify-between items-center">
                Do I need KYC verification?
                <span className="text-2xl group-open:rotate-180 transition">+</span>
              </summary>
              <p className="text-gray-600 mt-4">
                Yes, basic KYC is required. Provide your email, phone number, and full name. This protects all users on the platform.
              </p>
            </details>
          </div>
        </div>
      </section>
    </Layout>
  );
}
