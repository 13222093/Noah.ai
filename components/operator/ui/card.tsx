'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

/* --------------------------------- Variants -------------------------------- */
// Flat panels: surface-1 with a 1px border, 4px radius. No glass, gradient,
// glow, lift or mount animation (docs/design/palette.md). The old variant
// names are kept so callers keep compiling; they all render flat.
const cardVariants = cva(
  [
    'group relative isolate',
    'bg-op-surface-1 text-op-fg border border-op-border',
    'rounded-lg',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-op-accent',
  ].join(' '),
  {
    variants: {
      variant: {
        default: '',
        glass: '',
        elevated: 'bg-op-surface-2',
        outline: 'bg-transparent border-op-border-strong',
        gradient: '',
      },
      size: {
        sm: 'p-3',
        default: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
      },
      hover: {
        none: '',
        lift: '',
        scale: '',
        glow: 'hover:border-op-border-strong',
      },
      inset: {
        false: '',
        true: '',
      },
      interactive: {
        false: '',
        true: 'cursor-pointer select-none hover:border-op-border-strong',
      },
      rounded: {
        md: 'rounded-md',
        lg: 'rounded-lg',
        xl: 'rounded-lg',
        '2xl': 'rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      hover: 'none',
      inset: false,
      interactive: false,
      rounded: 'lg',
    },
  },
);

/* ---------------------------- Size context (UX) ---------------------------- */
type CardSize = NonNullable<VariantProps<typeof cardVariants>['size']>;
const CardSizeContext = React.createContext<CardSize>('default');
const useCardSize = () => React.useContext(CardSizeContext);

const sectionPaddingBySize: Record<CardSize, string> = {
  sm: 'px-3 py-2',
  default: 'px-4 py-3',
  lg: 'px-6 py-4',
  xl: 'px-8 py-6',
};

/* --------------------------------- Types ---------------------------------- */
type OmittedHTMLDivAttributes = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  | 'onDrag'
  | 'onDragEnd'
  | 'onDragStart'
  | 'onDragOver'
  | 'onDragEnter'
  | 'onDragLeave'
  | 'onDrop'
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
>;

export interface CardProps
  extends OmittedHTMLDivAttributes,
    VariantProps<typeof cardVariants> {
  asChild?: boolean;
  /** Ignored: cards do not animate (kept for compatibility). */
  animateIn?: boolean;
}

/* --------------------------------- Card ----------------------------------- */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant,
      size = 'default',
      hover,
      inset,
      interactive,
      rounded,
      asChild = false,
      animateIn = true,
      children,
      ...props
    },
    ref,
  ) => {
    // `animateIn` is accepted for compatibility; cards no longer animate.
    void animateIn;
    const classes = cn(cardVariants({ variant, size, hover, inset, interactive, rounded }), className);

    if (asChild) {
      // When using asChild (e.g., wrapping a Link), keep classes + a11y
      return (
        <CardSizeContext.Provider value={size}>
          <Slot
            ref={ref as any}
            className={classes}
            {...props}
            // maintain role for non-semantic wrappers
            role={props.role ?? 'region'}
            aria-label={props['aria-label']}
          >
            {children}
          </Slot>
        </CardSizeContext.Provider>
      );
    }

    return (
      <CardSizeContext.Provider value={size}>
        <div ref={ref} className={classes} role={props.role ?? 'region'} {...props}>
          {children}
        </div>
      </CardSizeContext.Provider>
    );
  },
);
Card.displayName = 'Card';

/* ------------------------------ Subcomponents ----------------------------- */
export interface CardSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  bleed?: boolean; // allow edge-to-edge content (media, charts)
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, bleed = false, ...props }, ref) => {
    const size = useCardSize();
    return (
      <div
        ref={ref}
        className={cn(
          bleed ? 'p-0' : sectionPaddingBySize[size],
          'flex flex-col gap-1.5',
          'border-b border-op-border',
          className,
        )}
        {...props}
      />
    );
  },
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  const size = useCardSize();
  const titleSize =
    size === 'xl'
      ? 'text-2xl'
      : size === 'lg'
        ? 'text-xl'
        : size === 'sm'
          ? 'text-base'
          : 'text-lg';
  return (
    <h3
      ref={ref}
      className={cn(
        'font-semibold tracking-tight',
        titleSize,
        'text-op-fg',
        className,
      )}
      {...props}
    />
  );
});
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      'text-op-fg-2 leading-relaxed',
      'text-sm',
      className,
    )}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, bleed = false, ...props }, ref) => {
    const size = useCardSize();
    return (
      <div
        ref={ref}
        className={cn(bleed ? 'p-0' : sectionPaddingBySize[size], className)}
        {...props}
      />
    );
  },
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, bleed = false, ...props }, ref) => {
    const size = useCardSize();
    return (
      <div
        ref={ref}
        className={cn(
          bleed ? 'p-0' : sectionPaddingBySize[size],
          'flex items-center gap-3 border-t border-op-border',
          className,
        )}
        {...props}
      />
    );
  },
);
CardFooter.displayName = 'CardFooter';
