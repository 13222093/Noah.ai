'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  AlertTriangle,
  Database,
  BrainCircuit,
  MoreHorizontal,
  BarChart3,
  GraduationCap,
  Settings,
  Phone,
  Info,
  Shield,
  Loader,
  CloudSun,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlertCount } from '@/components/contexts/AlertCountContext';
import { usePanel, PanelId } from '@/components/panels/PanelContext';

interface NavRailItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href?: string;
  panelId?: PanelId;
  action?: 'overflow';
}

const navItems: NavRailItem[] = [
  { id: 'command', label: 'Command', icon: LayoutDashboard, href: '/dashboard', panelId: 'alerts' },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle, href: '/alerts', panelId: 'alerts' },
  { id: 'data', label: 'Data', icon: Database, href: '/sensor-data', panelId: 'data' },
  { id: 'weather', label: 'Weather', icon: CloudSun, href: '/current-weather', panelId: 'weather' },
  { id: 'ai-tools', label: 'AI Tools', icon: BrainCircuit, panelId: 'ai-tools' },
  { id: 'more', label: 'More', icon: MoreHorizontal, action: 'overflow' },
];

const overflowItems = [
  { id: 'statistics', label: 'Statistics', icon: BarChart3, href: '/statistics' },
  { id: 'education', label: 'Education', icon: GraduationCap, href: '/education' },
  { id: 'sms', label: 'SMS Alert', icon: Phone, href: '/sms-subscribe' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  { id: 'about', label: 'About', icon: Info, href: '/about.html?mode=read' },
  { id: 'privacy', label: 'Privacy', icon: Shield, href: '/privacy' },
];

export function NavRail() {
  const router = useRouter();
  const pathname = usePathname();
  const { highAlertCount, loadingAlerts } = useAlertCount();
  const { activePanel, setPanel } = usePanel();
  const [isPending, startTransition] = useTransition();
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [pendingPanel, setPendingPanel] = useState<PanelId | null>(null);

  const isDashboard = pathname === '/dashboard' || pathname === '/';

  // Bug #4 fix: Set panel after navigation completes (replaces fragile setTimeout)
  useEffect(() => {
    if (isDashboard && pendingPanel) {
      setPanel(pendingPanel);
      setPendingPanel(null);
    }
  }, [isDashboard, pendingPanel, setPanel]);

  const handleNavigate = (href: string) => {
    setLoadingPath(href);
    setIsOverflowOpen(false);
    startTransition(() => {
      router.push(href);
    });
  };

  const handleNavClick = (item: NavRailItem) => {
    setIsOverflowOpen(false);

    // Command button: always go to dashboard
    if (item.id === 'command') {
      if (isDashboard) {
        // Already on dashboard — reset panel to default
        setPanel('alerts');
      } else {
        // Navigate to dashboard
        handleNavigate('/dashboard');
      }
      return;
    }

    // Items with href: always navigate to that page
    if (item.href) {
      handleNavigate(item.href);
      return;
    }

    // Panel-only items (no href): swap panel on dashboard, or navigate to dashboard + set panel
    if (item.panelId) {
      if (isDashboard) {
        setPanel(item.panelId);
      } else {
        handleNavigate('/dashboard');
        setPendingPanel(item.panelId);
      }
      return;
    }
  };

  const isActive = (item: NavRailItem) => {
    if (isDashboard && item.panelId) {
      // Bug #1 fix: Command nav only navigates; panel-specific items show active state
      if (item.id === 'command') return false;
      return activePanel === item.panelId;
    }
    if (item.id === 'command') return pathname === '/dashboard';
    if (item.id === 'alerts') return pathname === '/alerts';
    if (item.id === 'data') return pathname === '/sensor-data' || pathname === '/evacuation';
    if (item.id === 'ai-tools') return pathname === '/flood-predict' || pathname === '/visual-verify' || pathname === '/cctv-simulation';
    return false;
  };

  return (
    <nav className="cc-nav-rail" aria-label="Main navigation">
      {/* Logo */}
      <div className="cc-nav-logo">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cc-cyan to-cc-cyan/60 flex items-center justify-center">
          <span className="text-xs font-bold text-cc-bg font-heading">N</span>
        </div>
      </div>

      {/* Nav Items */}
      <div className="flex-1 flex flex-col items-center gap-1 py-2">
        {navItems.map((item) => {
          const active = isActive(item);
          const isLoading = isPending && loadingPath === item.href;
          const showBadge = item.id === 'alerts' && highAlertCount > 0 && !loadingAlerts;

          if (item.action === 'overflow') {
            return (
              <div key={item.id} className="relative">
                <button
                  onClick={() => setIsOverflowOpen(!isOverflowOpen)}
                  className={cn(
                    'cc-nav-item',
                    isOverflowOpen && 'cc-nav-item--active'
                  )}
                  title={item.label}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="cc-nav-label">{item.label}</span>
                </button>

                {/* Overflow menu */}
                {isOverflowOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsOverflowOpen(false)}
                    />
                    <div className="absolute left-[calc(100%+8px)] bottom-0 z-50 w-48 py-2 bg-cc-surface border border-cc-border rounded-lg shadow-xl">
                      {overflowItems.map((overflow) => (
                        <button
                          key={overflow.id}
                          onClick={() => overflow.href && handleNavigate(overflow.href)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-cc-text-secondary hover:text-cc-text hover:bg-cc-elevated transition-colors"
                        >
                          <overflow.icon className="w-4 h-4" />
                          <span>{overflow.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              disabled={isPending}
              className={cn(
                'cc-nav-item',
                active && 'cc-nav-item--active'
              )}
              title={item.label}
            >
              <div className="relative">
                {isLoading ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <item.icon className="w-5 h-5" />
                )}
                {showBadge && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold bg-cc-critical text-white rounded-full font-mono">
                    {highAlertCount}
                  </span>
                )}
              </div>
              <span className="cc-nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
