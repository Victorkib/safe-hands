'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function TopNav() {
  const { user, profile, loading } = useAuth();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const userRole = profile?.role;

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/');
      setShowMobileMenu(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isAuthPage = pathname?.startsWith('/auth');
  const isDashboard = pathname?.startsWith('/dashboard');

  // Get dashboard link based on role
  const getDashboardLink = () => {
    if (!userRole) return '/dashboard/buyer';
    switch (userRole) {
      case 'admin':
        return '/dashboard/admin';
      case 'seller':
      case 'buyer_seller':
        return '/dashboard/seller';
      default:
        return '/dashboard/buyer';
    }
  };

  // Public nav items
  const publicNavItems = [
    { name: 'Home', href: '/' },
    { name: 'Marketplace', href: '/marketplace' },
  ];

  // Authenticated nav items
  const authenticatedNavItems = [
    { name: 'Dashboard', href: getDashboardLink() },
    { name: 'Marketplace', href: '/marketplace' },
  ];

  const navItems = user ? authenticatedNavItems : publicNavItems;

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">
              SH
            </div>
            <span className="text-lg font-bold text-gray-900 hidden sm:inline">
              Safe Hands
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-colors ${
                  pathname === item.href
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* User Menu / Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      {user.email?.split('@')[0]}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <>
                    <Link
                      href="/auth/login"
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
                    >
                      Login
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={showMobileMenu ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
              />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-gray-200 py-4 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2 rounded-lg transition-colors ${
                  pathname === item.href
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => setShowMobileMenu(false)}
              >
                {item.name}
              </Link>
            ))}

            {!loading && (
              <div className="pt-3 border-t border-gray-200 space-y-2">
                {user ? (
                  <>
                    <p className="px-4 py-2 text-sm text-gray-600">
                      {user.email}
                    </p>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/login"
                      className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition text-center"
                      onClick={() => setShowMobileMenu(false)}
                    >
                      Login
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="block px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition text-center"
                      onClick={() => setShowMobileMenu(false)}
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
