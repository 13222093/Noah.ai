import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs font-medium ring-offset-op-page transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-op-accent focus-visible:ring-offset-1 disabled:pointer-events-none disabled:text-op-fg-disabled',
  {
    variants: {
      variant: {
        default: 'border border-white/10 bg-white/5 text-op-fg hover:bg-white/10',
        destructive:
          'bg-op-danger text-op-on-danger hover:bg-op-danger/90',
        outline:
          'border border-white/10 bg-op-surface-1 text-op-fg hover:bg-white/5',
        secondary:
          'border border-white/5 bg-op-surface-2 text-op-fg hover:bg-op-surface-3',
        ghost: 'text-op-fg-2 hover:bg-white/5 hover:text-op-fg',
        link: 'text-op-accent underline-offset-4 hover:underline',
        // Primary action: the interaction accent.
        primary: 'bg-op-accent-fill text-op-on-accent hover:bg-op-accent-fill/90',
        // Kept for compatibility; renders as a flat secondary button.
        glass: 'border border-white/5 bg-op-surface-2 text-op-fg hover:bg-op-surface-3',
      },
      size: {
        default: 'h-8 px-3 py-1.5',
        sm: 'h-7 px-2.5 text-xs',
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
