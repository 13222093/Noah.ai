'use client';

import { useTransition, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

// Operator navigation. W1 has only Ringkasan and Pengaturan; Polder,
// Rekomendasi, Skor, Laporan and Admin are added (role-filtered) in W2-W3.
export interface NavRailItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
}

export const NAV_ITEMS: NavRailItem[] = [
  { id: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard, href: '/' },
  { id: 'pengaturan', label: 'Pengaturan', icon: Settings, href: '/settings' },
];

export function NavRail() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [loadingPath, setLoadingPath] = useState<string | null>(null);

  const navigate = (href: string) => {
    setLoadingPath(href);
    startTransition(() => router.push(href));
  };

  return (
    <nav className="cc-nav-rail" aria-label="Navigasi utama">
      <div className="cc-nav-logo">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cc-cyan to-cc-cyan/60 flex items-center justify-center">
          <span className="text-xs font-bold text-cc-bg font-heading">N</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center gap-1 py-2">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const isLoading = isPending && loadingPath === item.href;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.href)}
              disabled={isPending}
              className={cn('cc-nav-item', active && 'cc-nav-item--active')}
              title={item.label}
              aria-current={active ? 'page' : undefined}
            >
              {isLoading ? <Loader className="w-5 h-5 animate-spin" /> : <item.icon className="w-5 h-5" />}
              <span className="cc-nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
