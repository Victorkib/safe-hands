import { redirect } from 'next/navigation';

export default function LegacyMarketplaceRedirect() {
  redirect('/dashboard/marketplace');
}
