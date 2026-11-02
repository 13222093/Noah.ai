import { redirect } from 'next/navigation';

// The old public dashboard (random water levels and pumps, D5) was removed in W1.
// Keep the path so old bookmarks land on Ringkasan.
export default function DashboardRedirect() {
  redirect('/');
}
