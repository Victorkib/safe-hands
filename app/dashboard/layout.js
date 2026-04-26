'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/shared/Layout';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [isProtected, setIsProtected] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      setIsProtected(true);
    };

    checkAuth();
  }, [router]);

  if (!isProtected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  return <Layout>{children}</Layout>;
}
