import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/lib/utils';

const tagVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none transition-colors',
  {
    variants: {
      tone: {
        neutral:
          'border-[var(--assistant-tag-border)] bg-[var(--assistant-tag-bg)] text-[var(--assistant-tag-text)]',
        ghost: 'border-border/50 bg-transparent text-muted-foreground',
        accent:
          'border-[color:var(--assistant-accent)]/30 bg-[var(--assistant-accent-soft)] text-[var(--assistant-accent)]',
        success:
          'border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300',
        danger:
          'border-red-200/60 bg-red-50 text-red-600 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300',
      },
      size: {
        sm: 'h-5',
        md: 'h-6 text-[11px]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'sm',
    },
  }
);

export type TagProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof tagVariants> & {
    asChild?: boolean;
  };

export function Tag({ className, tone, size, asChild = false, ...props }: TagProps) {
  const Comp = asChild ? Slot : 'span';

  return <Comp className={cn(tagVariants({ tone, size }), className)} {...props} />;
}
