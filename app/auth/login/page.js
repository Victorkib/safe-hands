import LoginForm from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Login - Safe Hands Escrow',
  description: 'Login to your Safe Hands Escrow account and manage your transactions.',
};

export default function LoginPage() {
  return <LoginForm />;
}
