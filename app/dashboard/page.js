'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function DashboardRedirect() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const redirectBasedOnRole = async () => {
      try {
        if (!user) {
          router.push('/auth/login');
          return;
        }

        const role = profile?.role;
        
        // Redirect based on role
        let redirectPath;
        switch (role) {
          case 'admin':
            redirectPath = '/dashboard/admin';
            break;
          case 'seller':
          case 'buyer_seller':
            redirectPath = '/dashboard/seller';
            break;
          case 'buyer':
          default:
            redirectPath = '/dashboard/buyer';
            break;
        }

        router.push(redirectPath);
      } catch (error) {
        console.error('Dashboard redirect error:', error);
        router.push('/auth/login');
      } finally {
        setIsLoading(false);
      }
    };

    redirectBasedOnRole();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return null;
}
