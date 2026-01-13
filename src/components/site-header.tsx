import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { SidebarTrigger } from "~/components/ui/sidebar"
import { useMatches } from "@tanstack/react-router"

// Map route IDs to page titles
const routeTitles: Record<string, string> = {
  '/agents/documents': 'Documents / KB',
  '/agents/claude-chat': 'Claude Chat',
  '/agents/chat': 'Chat',
  '/agents/image-chat': 'Image Chat',
  '/agents/workflow': 'Workflow',
  '/agents/charts': 'Dashboard',
  '/agents/skills': 'Skills',
  '/agents/billing': 'Billing',
  '/agents/settings/billing': 'Billing Settings',
}

export function SiteHeader() {
  const matches = useMatches()

  // Get the current route's title from the last matching route
  const currentRoute = matches[matches.length - 1]
  const title = currentRoute?.pathname
    ? routeTitles[currentRoute.pathname] || 'Agent'
    : 'Agent'

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" asChild size="sm" className="hidden sm:flex">
            <a
              href="https://x.com/Stephen4171127"
              rel="noopener noreferrer"
              target="_blank"
              className="dark:text-foreground"
            >
              X
            </a>
          </Button>
        </div>
      </div>
    </header>
  )
}
