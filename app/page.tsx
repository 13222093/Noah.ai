import type { Metadata } from 'next';
import { RingkasanView } from '@/components/ringkasan/RingkasanView';

export const metadata: Metadata = {
  title: 'Ringkasan | Noah AI',
};

// Ringkasan (overview). W1 placeholder: map shell plus honest empty states.
export default function RingkasanPage() {
  return <RingkasanView />;
}
