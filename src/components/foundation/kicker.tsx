import type { HTMLAttributes } from 'react';
import { cn } from '~/lib/utils';

export function Kicker({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('text-[11px] uppercase tracking-wide text-muted-foreground', className)}
      {...props}
    />
  );
}
