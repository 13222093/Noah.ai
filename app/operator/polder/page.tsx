import type { Metadata } from 'next';
import { PolderIndexView } from '@/components/operator/polder/PolderIndexView';

export const metadata: Metadata = {
  title: 'Polder · Operator | Noah AI',
};

export default function PolderIndexPage() {
  return <PolderIndexView />;
}
