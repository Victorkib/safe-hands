'use client';

import TopNav from '@/components/navigation/TopNav';
import Footer from '@/components/shared/Footer';

export default function PublicLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <TopNav />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
