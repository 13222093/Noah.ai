import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded text-sm font-medium ring-offset-op-page transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-op-accent focus-visible:ring-offset-1 disabled:pointer-events-none disabled:text-op-fg-disabled',
  {
    variants: {
      variant: {
        default: 'border border-op-border-strong bg-op-surface-3 text-op-fg hover:border-op-fg-3',
        destructive:
          'bg-op-danger text-op-on-danger hover:bg-op-danger/90',
        outline:
          'border border-op-border-strong bg-op-surface-1 text-op-fg hover:bg-op-surface-3',
        secondary:
          'border border-op-border bg-op-surface-2 text-op-fg hover:bg-op-surface-3',
        ghost: 'text-op-fg-2 hover:bg-op-surface-3 hover:text-op-fg',
        link: 'text-op-accent underline-offset-4 hover:underline',
        // Primary action: the interaction accent.
        primary: 'bg-op-accent-fill text-op-on-accent hover:bg-op-accent-fill/90',
        // Kept for compatibility; renders as a flat secondary button.
        glass: 'border border-op-border bg-op-surface-2 text-op-fg hover:bg-op-surface-3',
      },
      size: {
        default: 'h-9 px-3 py-1.5',
        sm: 'h-8 px-2.5 text-xs',
        lg: 'h-10 px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
