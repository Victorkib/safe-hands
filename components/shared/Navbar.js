'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push('/');
      setShowMenu(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white text-blue-600 rounded-full flex items-center justify-center font-bold">
              S
            </div>
            <span className="text-xl font-bold hidden sm:inline">Safe Hands Escrow</span>
            <span className="text-xl font-bold sm:hidden">Safe Hands</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="hover:text-blue-100 transition">
              Home
            </Link>
            {!user && (
              <>
                <Link href="/auth/login" className="hover:text-blue-100 transition">
                  Login
                </Link>
                <Link
                  href="/auth/signup"
                  className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition font-medium"
                >
                  Sign Up
                </Link>
              </>
            )}
            {user && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-blue-100">Welcome, {user.email?.split('@')[0]}</span>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="w-10 h-10 bg-white text-blue-600 rounded-full flex items-center justify-center hover:bg-blue-50 transition"
                >
                  {user.email?.charAt(0).toUpperCase()}
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            {!user && (
              <Link
                href="/auth/login"
                className="bg-white text-blue-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition"
              >
                Login
              </Link>
            )}
            {user && (
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="text-white hover:text-blue-100"
              >
                ☰
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Menu */}
        {user && showMenu && (
          <div className="md:hidden bg-blue-700 border-t border-blue-500 py-3 px-4">
            <Link
              href="/dashboard/profile"
              className="block text-white hover:text-blue-100 py-2 transition"
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="block w-full text-left text-white hover:text-blue-100 py-2 transition"
            >
              Logout
            </button>
          </div>
        )}

        {/* Desktop Dropdown */}
        {user && showMenu && (
          <div className="hidden md:block absolute right-8 mt-2 bg-white text-gray-800 rounded-lg shadow-xl py-2 min-w-48 z-50">
            <Link
              href="/dashboard/profile"
              className="block px-4 py-2 hover:bg-gray-100 transition"
            >
              Profile
            </Link>
            <Link
              href="/dashboard/buyer"
              className="block px-4 py-2 hover:bg-gray-100 transition"
            >
              Buyer Dashboard
            </Link>
            <Link
              href="/dashboard/seller"
              className="block px-4 py-2 hover:bg-gray-100 transition"
            >
              Seller Dashboard
            </Link>
            <hr className="my-2" />
            <button
              onClick={handleLogout}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100 transition text-red-600 font-medium"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
