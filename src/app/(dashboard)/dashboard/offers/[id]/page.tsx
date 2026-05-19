import { redirect } from 'next/navigation';

export default async function DashboardOfferDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/offers/${id}`);
}
