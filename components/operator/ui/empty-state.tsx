import type { ReactNode, ElementType } from 'react';
import { DatabaseZap } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Honest empty state: used wherever real data does not exist yet.
 * Never replace this with placeholder numbers.
 */
export function EmptyState({
  title = 'Data belum tersedia',
  description,
  icon: Icon = DatabaseZap,
  children,
  className,
}: {
  title?: string;
  description?: ReactNode;
  icon?: ElementType;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-4 py-6 text-center',
        className,
      )}
    >
      <Icon className="h-5 w-5 text-op-fg-3" aria-hidden />
      <p className="text-sm font-medium text-op-fg">{title}</p>
      {description && <p className="max-w-xs text-xs text-op-fg-2">{description}</p>}
      {children}
    </div>
  );
}
