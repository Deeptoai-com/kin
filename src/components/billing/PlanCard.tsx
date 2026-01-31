import * as React from 'react';
import { useIntlayer } from 'react-intlayer';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';

type PlanCardProps = {
  name: string;
  price: string;
  features: string[];
  current?: boolean;
  cta: React.ReactNode;
};

export function PlanCard({ name, price, features, current, cta }: PlanCardProps) {
  const content = useIntlayer('billing');
  return (
    <div
      className={cn(
        'flex h-full flex-col rounded border bg-card p-4 text-card-foreground shadow-sm transition hover:shadow-md',
        current ? 'ring-2 ring-primary' : 'ring-1 ring-muted'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-semibold">{name}</div>
          <div className="mt-1 text-2xl font-bold">{price}</div>
        </div>
        {current ? <Badge variant="secondary">{content.currentPlanBadge}</Badge> : null}
      </div>
      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
        {features.map((feature) => (
          <li key={feature}>• {feature}</li>
        ))}
      </ul>
      <div className="mt-4 flex-1" />
      <div className="mt-4">
        {current ? (
          <div className="text-center text-sm text-muted-foreground">{content.currentPlanBadge}</div>
        ) : (
          cta
        )}
      </div>
    </div>
  );
}
