import { Link } from '@tanstack/react-router';
import type * as React from 'react';
import { NavMain } from '~/components/nav-main';
import { NavUser } from '~/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '~/components/ui/sidebar';
import DashboardIcon from 'virtual:icons/ri/dashboard-line';
import ChatIcon from 'virtual:icons/ri/chat-3-line';
import ImageIcon from 'virtual:icons/ri/image-line';
import FileTextIcon from 'virtual:icons/ri/file-text-line';
import FlowChartIcon from 'virtual:icons/ri/flow-chart';
import HomeSmileIcon from 'virtual:icons/ri/home-smile-line';
import SparklingIcon from 'virtual:icons/ri/sparkling-line';
import SettingsIcon from 'virtual:icons/ri/settings-4-line';
import { FEATURE_CONFIG } from '~/config/features';

const navSections = [
  // Section 1: Claude Agent SDK
  {
    items: [
      {
        title: 'Claude Chat',
        url: '/agents/claude-chat',
        icon: SparklingIcon,
        enabled: FEATURE_CONFIG.claudeChat,
      },
      {
        title: 'Skills Store',
        url: '/agents/skills',
        icon: SettingsIcon,
        enabled: FEATURE_CONFIG.skills,
      },
    ],
    hasDivider: true,
  },
  // Section 2: AI SDK (using @ai-sdk/react + AI Elements)
  {
    items: [
      {
        title: 'AI Chat',
        url: '/agents/ai-chat',
        icon: ChatIcon,
        enabled: FEATURE_CONFIG.aiChat,
      },
      {
        title: 'AI Workflow',
        url: '/agents/ai-workflow',
        icon: FlowChartIcon,
        enabled: FEATURE_CONFIG.aiWorkflow,
      },
    ],
    hasDivider: true,
  },
  // Section 3: Other
  {
    items: [
      {
      title: 'Documents / KB',
      url: '/agents/documents',
      icon: FileTextIcon,
      enabled: FEATURE_CONFIG.documents,
      },
      {
        title: 'Dashboards',
        url: '/agents/charts',
        icon: DashboardIcon,
        enabled: FEATURE_CONFIG.dashboard,
      },
    ],
  },
].map((section) => ({
  ...section,
  items: section.items.filter((item) => item.enabled),
})).filter((section) => section.items.length > 0);

type SidebarUser = {
  name?: string | null;
  email: string;
  image?: string | null;
};

export function AppSidebar({ user, ...props }: React.ComponentProps<typeof Sidebar> & { user: SidebarUser }) {
  const resolvedUser = {
    name: user.name ?? user.email,
    email: user.email,
    avatar: user.image ?? null,
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link to="/">
                <HomeSmileIcon className="!size-5" />
                <span className="font-semibold text-base">Claude Agent Chat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain sections={navSections} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={resolvedUser} />
      </SidebarFooter>
    </Sidebar>
  );
}
