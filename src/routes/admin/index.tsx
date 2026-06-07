/**
 * Admin Dashboard
 *
 * System administrator dashboard home page
 */

import { createFileRoute } from '@tanstack/react-router';
import { useIntlayer } from 'react-intlayer';
import { toLocalizedString } from '~/lib/utils';
import { requireSystemAdmin, getAllUsers, getAllOrganizations } from '~/server/admin.server';
import RiUserLine from '~icons/ri/user-line';
import RiBuilding4Line from '~icons/ri/building-4-line';
import RiShieldCheckLine from '~icons/ri/shield-check-line';

export const Route = createFileRoute('/admin/')({
  loader: async () => {
    // Verify admin and get admin info
    const admin = await requireSystemAdmin();

    // Get stats
    const [users, orgs] = await Promise.all([
      getAllUsers(),
      getAllOrganizations(),
    ]);

    return { admin, users, orgs };
  },
  component: AdminDashboard,
});

function AdminDashboard() {
  const content = useIntlayer('admin');
  const { admin, users, orgs } = Route.useLoaderData();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {toLocalizedString(content.dashboard.welcome).replace('{name}', admin.name ?? '')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {content.dashboard.systemAdminDashboard}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{content.dashboard.overview.totalUsers}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{users.length}</p>
            </div>
            <RiUserLine className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{content.dashboard.overview.organizations}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{orgs.length}</p>
            </div>
            <RiBuilding4Line className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{content.dashboard.systemRole}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{content.users.roles.admin}</p>
            </div>
            <RiShieldCheckLine className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {content.dashboard.quickActions}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/admin/users"
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {content.dashboard.manageUsers}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {content.dashboard.manageUsersDesc}
            </p>
          </a>

          <a
            href="/admin/organizations"
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {content.dashboard.manageOrganizations}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {content.dashboard.manageOrgsDesc}
            </p>
          </a>

          <a
            href="/admin/models"
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              模型与健康
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              查看模型健康度、启用/停用、设默认、重新探活（多模型）
            </p>
          </a>
        </div>
      </div>
    </div>
  );
}
