import { Suspense } from 'react';
import BuyerPaymentsContent from './BuyerPaymentsContent';

function PaymentsFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>
  );
}

export default function BuyerPaymentsPage() {
  return (
    <Suspense fallback={<PaymentsFallback />}>
      <BuyerPaymentsContent />
    </Suspense>
  );
}
