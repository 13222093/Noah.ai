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
      <Icon className="h-6 w-6 text-cc-text-muted" aria-hidden />
      <p className="text-sm font-medium text-cc-text">{title}</p>
      {description && <p className="max-w-xs text-xs text-cc-text-muted">{description}</p>}
      {children}
    </div>
  );
}
