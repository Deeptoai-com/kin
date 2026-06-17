import type { ReactNode } from 'react';
import { useIntlayer } from 'react-intlayer';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb';
import { settingsNavItems, type SettingsSection } from './settings-nav';

interface SettingsContentProps {
  readonly activeSection: SettingsSection;
  readonly children: ReactNode;
}

export function SettingsContent({ activeSection, children }: SettingsContentProps) {
  const content = useIntlayer('settings');

  // Create a mapping of section to localized label
  const getSectionLabel = (section: SettingsSection): string => {
    const labelMap: Record<SettingsSection, string> = {
      account: content.sections.account.title,
      preferences: content.sections.preferences.title,
      plans: content.sections.plans.title,
      billing: content.sections.billing.title,
    };
    return labelMap[section];
  };

  return (
    <main className="flex h-full flex-1 flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">{content.page.breadcrumb}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{getSectionLabel(activeSection)}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">{children}</div>
    </main>
  );
}
