'use client';

import dynamic from 'next/dynamic';
import { AuthProvider } from '@/context/AuthContext';

const Analytics = dynamic(
  () => import('@vercel/analytics/next').then((mod) => mod.Analytics),
  { ssr: false }
);

export default function ClientProviders({ children }) {
  return (
    <AuthProvider>
      {children}
      {process.env.NODE_ENV === 'production' ? <Analytics /> : null}
    </AuthProvider>
  );
}
