'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Navigation */}
      <nav className="flex justify-between items-center px-6 py-4 border-b border-slate-700">
        <div className="text-2xl font-bold text-emerald-500">Safe Hands</div>
        <div className="flex gap-4">
          <Link
            href="/auth/login"
            className="px-4 py-2 rounded-lg border border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-white transition"
          >
            Login
          </Link>
          <Link
            href="/auth/signup"
            className="px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition"
          >
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-20 text-center">
        <h1 className="text-5xl font-bold mb-6">Secure P2P Escrow Made Simple</h1>
        <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-8">
          Safe Hands Escrow provides a trusted platform for buyer and seller protection in Kenya. 
          Transact with confidence using our secure escrow service integrated with M-Pesa.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/signup"
            className="px-8 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition"
          >
            Get Started
          </Link>
          <Link
            href="#features"
            className="px-8 py-3 border border-emerald-500 text-emerald-500 rounded-lg font-semibold hover:bg-emerald-500 hover:text-white transition"
          >
            Learn More
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-6 py-20 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold mb-12 text-center">Why Choose Safe Hands?</h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
            <div className="text-emerald-500 text-4xl mb-4">🔒</div>
            <h3 className="text-xl font-semibold mb-3">Secure Escrow</h3>
            <p className="text-slate-300">
              Funds are held securely until both buyer and seller complete their obligations.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
            <div className="text-emerald-500 text-4xl mb-4">💳</div>
            <h3 className="text-xl font-semibold mb-3">M-Pesa Integration</h3>
            <p className="text-slate-300">
              Seamless M-Pesa integration for quick and easy payments in Kenya.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
            <div className="text-emerald-500 text-4xl mb-4">⚖️</div>
            <h3 className="text-xl font-semibold mb-3">Dispute Resolution</h3>
            <p className="text-slate-300">
              Fair and transparent dispute resolution by our trusted administrators.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
            <div className="text-emerald-500 text-4xl mb-4">⭐</div>
            <h3 className="text-xl font-semibold mb-3">Ratings & Trust</h3>
            <p className="text-slate-300">
              Build your reputation with verified ratings after each successful transaction.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
            <div className="text-emerald-500 text-4xl mb-4">📱</div>
            <h3 className="text-xl font-semibold mb-3">Mobile Ready</h3>
            <p className="text-slate-300">
              Access Safe Hands from any device. Fully responsive and mobile optimized.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
            <div className="text-emerald-500 text-4xl mb-4">🛡️</div>
            <h3 className="text-xl font-semibold mb-3">KYC Verified</h3>
            <p className="text-slate-300">
              Know Your Customer verification ensures platform safety and compliance.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-20 bg-slate-700/30">
        <h2 className="text-3xl font-bold mb-12 text-center">How It Works</h2>
        
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center font-bold text-lg">
              1
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Create Account</h3>
              <p className="text-slate-300">Sign up and verify your identity through our KYC process.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center font-bold text-lg">
              2
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Create Transaction</h3>
              <p className="text-slate-300">Buyer initiates a transaction with product details and amount.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center font-bold text-lg">
              3
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Pay with M-Pesa</h3>
              <p className="text-slate-300">Buyer sends funds via M-Pesa. Amount is held in escrow.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center font-bold text-lg">
              4
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Seller Ships</h3>
              <p className="text-slate-300">Seller ships the product and uploads proof of delivery.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center font-bold text-lg">
              5
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Confirm & Release</h3>
              <p className="text-slate-300">Buyer confirms delivery. Funds are released to seller.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center font-bold text-lg">
              6
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Rate & Review</h3>
              <p className="text-slate-300">Both parties rate each other to build trust in the community.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-6">Ready to Get Started?</h2>
        <p className="text-xl text-slate-300 mb-8">Join thousands of safe transactions happening on Safe Hands Escrow</p>
        <Link
          href="/auth/signup"
          className="inline-block px-8 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition text-lg"
        >
          Sign Up Now - It's Free!
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 px-6 py-8 text-center text-slate-400 text-sm">
        <p>&copy; 2024 Safe Hands Escrow. All rights reserved.</p>
      </footer>
    </div>
  );
}
