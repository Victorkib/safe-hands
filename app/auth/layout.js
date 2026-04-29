import AuthLayout from '@/components/layout/AuthLayout';

export const metadata = {
  title: 'Authentication - Safe Hands Escrow',
  description: 'Login or signup to Safe Hands Escrow',
};

export default function AuthLayoutPage({ children }) {
  return <AuthLayout>{children}</AuthLayout>;
}
