import type { Metadata } from 'next';
import { OperatorChrome } from '@/components/operator/layout/OperatorChrome';

// Operator section: a labelled replay of the 1 January 2020 flood for
// flood-control operators, added next to the original app (which is unchanged).
// Chrome-less in the app shell (like /dashboard); OperatorChrome draws its own top bar.
export const metadata: Metadata = {
  title: 'Operator | Noah AI',
  description:
    'Skenario historis 1 Januari 2020 (sebagian simulasi) untuk operator pengendalian banjir: ringkasan polder, detail polder dan rekomendasi.',
};

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return <OperatorChrome>{children}</OperatorChrome>;
}
