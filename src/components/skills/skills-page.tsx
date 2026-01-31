import { FC, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Zap, Code, Palette, Plug, CheckCircle, Circle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useIntlayer } from 'react-intlayer';
import { toLocalizedString } from '~/lib/utils';
import { Input } from '~/components/ui/input';
import { useServerFn } from '@tanstack/react-start';
import {
  enableUserSkill as enableUserSkillFn,
  disableUserSkill as disableUserSkillFn,
  enableUserUploadedSkillFn,
  disableUserUploadedSkillFn,
  deleteUserSkillFn,
  deleteGitHubSkillFn,
  getSkillDetailFn,
  setGlobalSkillEnabledFn,
} from '~/server/function/skills.server';
import type { ExtendedSkillInfo, SkillDetail } from '~/claude/skills';
import { SkillsSidebar } from './skills-sidebar';
import { SkillsGrid } from './skills-grid';
import { SkillDetailDialog } from './skill-detail-dialog';
import { SchemaManageDialog } from './schema-manage-dialog';

interface CategoryItem {
  id: string;
  label: string;
  icon: FC<{ className?: string }>;
}

// Get localized categories - will be initialized after content is available
const getCategories = (content: any): CategoryItem[] => [
  { id: 'all', label: content.categories.all, icon: Zap },
  { id: 'development', label: content.categories.development, icon: Code },
  { id: 'design', label: content.categories.design, icon: Palette },
  { id: 'productivity', label: content.categories.productivity, icon: Zap },
  { id: 'integration', label: content.categories.integration, icon: Plug },
  { id: 'installed', label: content.categories.installed, icon: CheckCircle },
];

/**
 * Skills Page Component
 *
 * Displays all skills (official + user) in a unified list.
 * Uses skill.store property to determine permissions and actions.
 *
 * Follows TanStack Start best practices:
 * - Data passed from loader (SSR + streaming)
 * - Server Functions for mutations (type-safe)
 * - No useEffect for data fetching
 */
export const SkillsPageComponent: FC<{
  skills: ExtendedSkillInfo[];
  enabledSkills: string[];
  isAdmin: boolean;
}> = ({ skills, enabledSkills: initialEnabledSkills, isAdmin }) => {
  const content = useIntlayer('skills');
  // Server Functions (type-safe RPC)
  const enableOfficialSkill = useServerFn(enableUserSkillFn);
  const disableOfficialSkill = useServerFn(disableUserSkillFn);
  const enableUserSkillServer = useServerFn(enableUserUploadedSkillFn);
  const disableUserSkillServer = useServerFn(disableUserUploadedSkillFn);
  const deleteUserSkill = useServerFn(deleteUserSkillFn);
  const deleteGitHubSkill = useServerFn(deleteGitHubSkillFn);
  const setGlobalSkill = useServerFn(setGlobalSkillEnabledFn);

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedSkillSlug, setSelectedSkillSlug] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [enabledSkills, setEnabledSkills] = useState<string[]>(() => initialEnabledSkills);
  const [globalSkills, setGlobalSkills] = useState<string[]>(() =>
    skills.filter((skill) => skill.globalEnabled).map((skill) => skill.slug)
  );
  const [schemaManageSlug, setSchemaManageSlug] = useState<string | null>(null);
  const [isSchemaDialogOpen, setIsSchemaDialogOpen] = useState(false);

  // Query for skill detail (lazy loading on dialog open)
  const { data: skillDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['skill-detail', selectedSkillSlug],
    queryFn: async () => {
      if (!selectedSkillSlug) return null;
      return await getSkillDetailFn({ data: { skillSlug: selectedSkillSlug } });
    },
    enabled: !!selectedSkillSlug && isDetailOpen,
  });

  // Handle toggle skill (using Server Functions)
  const handleToggleSkill = async (skillSlug: string) => {
    // Find the skill to determine its type
    const skill = skills.find(s => s.slug === skillSlug);
    if (!skill) {
      console.error('Skill not found:', skillSlug);
      toast.error(toLocalizedString(content.toast.skillNotFound));
      return;
    }

    if (globalSkills.includes(skillSlug)) {
      toast.error(toLocalizedString(content.toast.globalEnabledError));
      return;
    }

    const isEnabled = enabledSkills.includes(skillSlug);

    try {
      // Use appropriate function based on skill store
      if (skill.store === 'official') {
        // Official skills
        if (isEnabled) {
          await disableOfficialSkill({ data: { skillName: skillSlug } });
        } else {
          await enableOfficialSkill({ data: { skillName: skillSlug } });
        }
      } else {
        // User skills
        if (isEnabled) {
          await disableUserSkillServer({ data: { skillName: skillSlug } });
        } else {
          await enableUserSkillServer({ data: { skillName: skillSlug } });
        }
      }

      // Update local state so UI reflects the change immediately
      setEnabledSkills((prev) =>
        isEnabled ? prev.filter((s) => s !== skillSlug) : [...prev, skillSlug]
      );
    } catch (error) {
      console.error('Failed to toggle skill:', error);
      const message = error instanceof Error ? error.message : toLocalizedString(content.toast.toggleFailed);
      if (message.startsWith('SKILL_NOT_SYNCED:')) {
        const slug = message.split(':')[1]?.trim() ?? skillSlug;
        toast.error(toLocalizedString(content.toast.skillNotSynced).replace('{slug}', slug));
      } else if (message.includes('SKILL_GLOBAL_ENABLED')) {
        toast.error(toLocalizedString(content.toast.globalEnabledError));
      } else {
        toast.error(message);
      }
    }
  };

  const handleToggleGlobal = async (skillSlug: string) => {
    if (!isAdmin) return;
    const isGlobalEnabled = globalSkills.includes(skillSlug);
    try {
      const result = await setGlobalSkill({ data: { skillName: skillSlug, enabled: !isGlobalEnabled } });
      const updated = result?.skills ?? [];
      setGlobalSkills(updated);
      if (!isGlobalEnabled) {
        setEnabledSkills((prev) => (prev.includes(skillSlug) ? prev : [...prev, skillSlug]));
      }
    } catch (error) {
      console.error('Failed to toggle global skill:', error);
      const message = error instanceof Error ? error.message : toLocalizedString(content.toast.globalEnableFailed);
      toast.error(message);
    }
  };

  // Handle delete skill (user skills or GitHub-installed skills)
  const handleDeleteSkill = async (skillSlug: string) => {
    // Find the skill
    const skill = skills.find(s => s.slug === skillSlug);
    if (!skill) {
      console.error('Skill not found:', skillSlug);
      return;
    }

    // Check if skill can be deleted
    const canDelete = skill.store === 'user' || skill.deletable === true;
    if (!canDelete) {
      console.error('Cannot delete official skill:', skillSlug);
      alert(toLocalizedString(content.toast.cannotDeleteOfficial));
      return;
    }

    const confirmMessage = skill.store === 'user'
      ? toLocalizedString(content.toast.deleteConfirmCustom)
      : toLocalizedString(content.toast.deleteConfirmGithub);

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      if (skill.store === 'user') {
        // Delete user-uploaded skill
        await deleteUserSkill({ data: { skillName: skillSlug } });
      } else {
        // Delete GitHub-installed skill
        await deleteGitHubSkill({ data: { skillName: skillSlug } });
      }
      // Refresh page to update list
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete skill:', error);
      alert(`${toLocalizedString(content.toast.deleteFailed)}: ${(error as Error).message}`);
    }
  };

  // Handle view details
  const handleViewDetails = (skillSlug: string) => {
    setSelectedSkillSlug(skillSlug);
    setIsDetailOpen(true);
  };

  // Handle close detail dialog
  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedSkillSlug(null);
  };

  // Handle open schema manage dialog (admin only)
  const handleManageSchema = (skillSlug: string) => {
    setSchemaManageSlug(skillSlug);
    setIsSchemaDialogOpen(true);
  };

  // Handle close schema dialog
  const handleCloseSchemaDialog = () => {
    setIsSchemaDialogOpen(false);
    setSchemaManageSlug(null);
  };

  // Handle schema generation success
  const handleSchemaSuccess = () => {
    // Refresh page to show updated status
    window.location.reload();
  };

  // Filter skills based on search and category (computed on render)
  const filteredSkills = useMemo(() => {
    let result = skills;

    // Apply category filter
    if (activeFilter === 'installed') {
      result = result.filter((skill) => enabledSkills.includes(skill.slug));
    } else if (activeFilter !== 'all') {
      result = result.filter((skill) => skill.category === activeFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          (skill.description && skill.description.toLowerCase().includes(query))
      );
    }

    return result;
  }, [skills, activeFilter, searchQuery, enabledSkills]);

  // Get category counts
  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'all') return skills.length;
    if (categoryId === 'installed') return enabledSkills.length;
    return skills.filter((s) => s.category === categoryId).length;
  };

  const categories = getCategories(content);

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))]">
      {/* Left Sidebar */}
      <SkillsSidebar
        categories={categories}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        getCategoryCount={getCategoryCount}
      />

      {/* Right Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">
            {activeFilter === 'all'
              ? content.toolbar.allSkills
              : categories.find((c) => c.id === activeFilter)?.label || content.sidebar.title}
            <span className="ml-2 text-muted-foreground">
              • {filteredSkills.length}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={toLocalizedString(content.toolbar.searchPlaceholder)}
                className="w-64 pl-9"
              />
            </div>
          </div>
        </div>

        {/* Skills Grid */}
        <div className="flex-1 overflow-auto p-6">
          {filteredSkills.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Circle className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">{content.empty.title}</p>
                <p className="text-sm text-muted-foreground/70">
                  {content.empty.subtitle}
                </p>
              </div>
            </div>
          ) : (
            <SkillsGrid
              skills={filteredSkills}
              enabledSkills={enabledSkills}
              globalSkills={globalSkills}
              isAdmin={isAdmin}
              onToggleSkill={handleToggleSkill}
              onToggleGlobal={handleToggleGlobal}
              onViewDetails={handleViewDetails}
              onDeleteSkill={handleDeleteSkill}
              onManageSchema={handleManageSchema}
            />
          )}
        </div>
      </main>

      {/* Skill Detail Dialog */}
      <SkillDetailDialog
        skill={skillDetail ?? null}
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
      />

      {/* Schema Manage Dialog - Admin Only */}
      {isAdmin && (
        <SchemaManageDialog
          skillSlug={schemaManageSlug}
          skillName={skills.find(s => s.slug === schemaManageSlug)?.name ?? ''}
          isOpen={isSchemaDialogOpen}
          onClose={handleCloseSchemaDialog}
          onSuccess={handleSchemaSuccess}
        />
      )}
    </div>
  );
};
