import { FC } from 'react';
import { cn } from '~/lib/utils';

interface CategoryItem {
  id: string;
  label: string;
  icon: FC<{ className?: string }>;
}

interface McpSidebarProps {
  categories: CategoryItem[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  getCategoryCount: (categoryId: string) => number;
}

export const McpSidebar: FC<McpSidebarProps> = ({
  categories,
  activeFilter,
  onFilterChange,
  getCategoryCount,
}) => {
  return (
    <aside className="w-64 space-y-4 border-r px-4 py-6">
      <h2 className="font-semibold text-lg">MCP Store</h2>
      <nav className="space-y-1 text-sm">
        {categories.map((category) => {
          const Icon = category.icon;
          const count = getCategoryCount(category.id);
          const isActive = activeFilter === category.id;

          return (
            <div
              key={category.id}
              onClick={() => onFilterChange(category.id)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded px-3 py-2 transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-foreground/80 hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{category.label}</span>
              <span
                className={cn(
                  'text-xs',
                  isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
                )}
              >
                {count}
              </span>
            </div>
          );
        })}
      </nav>
    </aside>
  );
};
