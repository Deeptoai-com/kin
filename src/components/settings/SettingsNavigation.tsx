import { Link } from '@tanstack/react-router';
import { useIntlayer } from 'react-intlayer';
import { cn } from '~/lib/utils';
import { SidebarMenuButton, SidebarMenuItem } from '~/components/ui/sidebar';
import {
  settingsNavItems,
  type SettingsNavItem,
  type SettingsSection,
} from './settings-nav';
import RiBankCard2Line from '~icons/ri/bank-card-2-line';
import RiBillLine from '~icons/ri/bill-line';
import RiBuilding4Line from '~icons/ri/building-4-line';
import RiListSettingsLine from '~icons/ri/list-settings-line';
import RiUserSettingsLine from '~icons/ri/user-settings-line';

interface SettingsNavigationProps {
  readonly activeSection: SettingsSection;
}

// Icon mapping for sections
const iconMap = {
  account: RiUserSettingsLine,
  organization: RiBuilding4Line,
  preferences: RiListSettingsLine,
  plans: RiBankCard2Line,
  billing: RiBillLine,
} as const;

export function SettingsNavigation({ activeSection }: SettingsNavigationProps) {
  const content = useIntlayer('settings');

  // Create localized nav items
  const localizedNavItems: SettingsNavItem[] = [
    {
      section: 'account',
      label: content.sections.account.title,
      description: content.sections.account.description,
      icon: iconMap.account,
    },
    {
      section: 'organization',
      label: content.sections.organization.title,
      description: content.sections.organization.description,
      icon: iconMap.organization,
    },
    {
      section: 'preferences',
      label: content.sections.preferences.title,
      description: content.sections.preferences.description,
      icon: iconMap.preferences,
    },
    {
      section: 'plans',
      label: content.sections.plans.title,
      description: content.sections.plans.description,
      icon: iconMap.plans,
    },
    {
      section: 'billing',
      label: content.sections.billing.title,
      description: content.sections.billing.description,
      icon: iconMap.billing,
    },
  ];

  const renderNavItem = (item: SettingsNavItem) => {
    const isActive = item.section === activeSection;
    const Icon = item.icon;

    return (
      <SidebarMenuItem key={item.section}>
        <SidebarMenuButton asChild isActive={isActive}>
          <Link
            to="."
            search={(prev) => {
              const next = { ...prev } as Record<string, unknown>;
              next.settings = item.section;
              return next;
            }}
            className={cn(
              'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
              isActive
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="font-medium leading-none">{item.label}</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const workspaceItems = localizedNavItems.filter(
    (item) => item.section === 'account' || item.section === 'preferences'
  );
  const billingItems = localizedNavItems.filter(
    (item) => item.section === 'plans' || item.section === 'billing'
  );

  return (
    <div className="flex flex-col gap-6 px-2 py-4">
      <div className="space-y-2">
        <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {content.navigation.workspace}
        </p>
        <div className="space-y-1">{workspaceItems.map(renderNavItem)}</div>
      </div>
      <div className="space-y-2">
        <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {content.navigation.billing}
        </p>
        <div className="space-y-1">{billingItems.map(renderNavItem)}</div>
      </div>
    </div>
  );
}
