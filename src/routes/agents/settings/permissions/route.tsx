import { createFileRoute } from '@tanstack/react-router';
import { useIntlayer } from 'react-intlayer';
import { PermissionSettingsSection } from '~/components/settings/sections/PermissionSettings';
import { getPermissionInfo } from '~/server/permissions.server';

export const Route = createFileRoute('/agents/settings/permissions')({
  component: SettingsPermissionsRoute,
  loader: async () => {
    const permissionInfo = await getPermissionInfo();
    return { permissionInfo };
  },
});

function SettingsPermissionsRoute() {
  const { permissionInfo } = Route.useLoaderData();
  const content = useIntlayer('settings');

  return (
    <div className="container mx-auto max-w-4xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{content.sections.permissions.title}</h1>
        <p className="text-sm text-muted-foreground">
          {content.sections.permissions.description}
        </p>
      </header>

      <PermissionSettingsSection variant="page" permissionInfo={permissionInfo} />
    </div>
  );
}
