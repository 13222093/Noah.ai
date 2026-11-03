import type { Metadata } from 'next';
import { RingkasanView } from '@/components/operator/ringkasan/RingkasanView';

export const metadata: Metadata = {
  title: 'Ringkasan · Operator | Noah AI',
};

// Ringkasan (overview): map, polder ranking, open recommendations, data freshness.
export default function RingkasanPage() {
  return <RingkasanView />;
}
