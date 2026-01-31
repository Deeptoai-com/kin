import { createFileRoute } from '@tanstack/react-router';
import { useIntlayer } from 'react-intlayer';
import { BillingSettingsSection } from '~/components/settings/sections/BillingSettings';

export const Route = createFileRoute('/agents/settings/billing')({
  component: SettingsBillingRoute,
});

function SettingsBillingRoute() {
  const content = useIntlayer('settings');

  return (
    <div className="container mx-auto max-w-4xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{content.sections.billing.page.title}</h1>
        <p className="text-sm text-muted-foreground">
          {content.sections.billing.page.subtitle}
        </p>
      </header>

      <BillingSettingsSection variant="page" />
    </div>
  );
}
