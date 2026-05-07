import { Suspense } from 'react';
import SignUpForm from '@/components/auth/SignUpForm';

export const metadata = {
  title: 'Sign Up - Safe Hands Escrow',
  description: 'Create your Safe Hands Escrow account and start trading safely.',
};

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-600">Loading...</div>}>
      <SignUpForm />
    </Suspense>
  );
}
