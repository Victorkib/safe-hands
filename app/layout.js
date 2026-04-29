import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { AuthProvider } from '@/context/AuthContext';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });
const geistMono = Geist_Mono({ subsets: ['latin'] });

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata = {
  title: 'Safe Hands Escrow - Secure P2P Transactions',
  description:
    'A trusted escrow platform for secure peer-to-peer transactions in Kenya',
  keywords: 'escrow, p2p, transactions, kenya, mpesa, buyer, seller',
  authors: [{ name: 'Safe Hands Escrow Team' }],
  openGraph: {
    title: 'Safe Hands Escrow',
    description: 'Secure peer-to-peer transactions with escrow protection',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta name="theme-color" content="#2563eb" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body
        className={`${geist.className} antialiased bg-white text-slate-900`}
      >
        <AuthProvider>
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </AuthProvider>
      </body>
    </html>
  );
}
