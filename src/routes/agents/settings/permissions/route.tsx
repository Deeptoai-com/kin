import { createFileRoute } from '@tanstack/react-router';
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

  return (
    <div className="container mx-auto max-w-4xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">权限设置</h1>
        <p className="text-sm text-muted-foreground">
          配置组织的权限模式和工具访问控制
        </p>
      </header>

      <PermissionSettingsSection variant="page" permissionInfo={permissionInfo} />
    </div>
  );
}
