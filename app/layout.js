import { Geist } from 'next/font/google';
import ClientProviders from '@/components/providers/ClientProviders';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#2563eb',
};

export const metadata = {
  title: 'Safe Hands Escrow - Secure P2P Transactions',
  description:
    'A trusted escrow platform for secure peer-to-peer transactions in Kenya',
  keywords: 'escrow, p2p, transactions, kenya, mpesa, buyer, seller',
  authors: [{ name: 'Safe Hands Escrow Team' }],
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Safe Hands Escrow',
    description: 'Secure peer-to-peer transactions with escrow protection',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${geist.className} antialiased bg-white text-slate-900`}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
