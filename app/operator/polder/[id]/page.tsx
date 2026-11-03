import type { Metadata } from 'next';
import { PolderDetailView } from '@/components/operator/polder/PolderDetailView';

export const metadata: Metadata = {
  title: 'Detail polder · Operator | Noah AI',
};

// Polder detail. Also the landing page for links in operator WhatsApp
// messages, so it must work on a phone without passing through Ringkasan.
export default async function PolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PolderDetailView polderId={decodeURIComponent(id)} />;
}
