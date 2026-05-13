import { redirect } from 'next/navigation';

export default function LegacyListingRedirect({ params }) {
  redirect(`/dashboard/marketplace/${params.id}`);
}
