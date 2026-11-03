import { Suspense } from 'react';
import type { Metadata } from 'next';
import { RekomendasiView } from '@/components/operator/rekomendasi/RekomendasiView';

export const metadata: Metadata = {
  title: 'Rekomendasi · Operator | Noah AI',
};

export default function RekomendasiPage() {
  return (
    <Suspense fallback={null}>
      <RekomendasiView />
    </Suspense>
  );
}
