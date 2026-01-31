import { createFileRoute, Link } from '@tanstack/react-router';
import { useIntlayer } from 'react-intlayer';
import { toLocalizedString } from '~/lib/utils';
import { listAllSkillsFn, isAdminUser } from '~/server/function/skills.server';
import { SkillsPageComponent } from '~/components/skills/skills-page';
import { SkillUploadDialog } from '~/components/skills/skill-upload-dialog';
import { GitHubSkillInstaller } from '~/components/skills/github-skill-installer';
import type { ExtendedSkillInfo } from '~/claude/skills';
import { useState } from 'react';

/**
 * Skills Management Route
 *
 * Displays all skills (official + user-uploaded) in a unified list.
 * Differentiated by visual badges and permissions (user skills can be deleted).
 *
 * Follows TanStack Start best practices:
 * - Fetch on navigation: Load data in route loader
 * - Server Functions: Use RPC instead of REST API
 * - SSR + Streaming: Data is pre-fetched on server
 */
export const Route = createFileRoute('/agents/skills')({
  loader: async () => {
    // Load all skills (both official and user-uploaded)
    const [result, adminCheck] = await Promise.all([
      listAllSkillsFn(),
      isAdminUser(),
    ]);

    // Merge official and user skills into a single list
    const allSkills: ExtendedSkillInfo[] = [
      ...result.official,
      ...result.user,
    ];

    return {
      allSkills,
      isAdmin: adminCheck.isAdmin ?? false,
    };
  },
  component: () => {
    const { allSkills, isAdmin } = Route.useLoaderData();
    const content = useIntlayer('skills');
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [isGitHubInstallOpen, setIsGitHubInstallOpen] = useState(false);

    // Get enabled skills for both types
    const enabledSkills = allSkills.filter(s => s.enabled).map(s => s.slug);

    // Handle upload success
    const handleUploadSuccess = () => {
      // Refresh the page to show new skill
      window.location.reload();
    };

    return (
      <div className="container mx-auto py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{content.header.title}</h1>
            <p className="text-sm text-muted-foreground">
              {toLocalizedString(content.header.description).replace('{count}', String(allSkills.length))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* GitHub Install Button - Admin Only */}
            {isAdmin && (
              <button
                onClick={() => setIsGitHubInstallOpen(true)}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                {content.header.githubInstallButton}
              </button>
            )}
            <button
              onClick={() => setIsUploadDialogOpen(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              {content.header.uploadButton}
            </button>
          </div>
        </div>

        {/* Unified Skills List */}
        <SkillsPageComponent
          skills={allSkills}
          enabledSkills={enabledSkills}
          isAdmin={isAdmin}
        />

        {/* Upload Dialog */}
        <SkillUploadDialog
          open={isUploadDialogOpen}
          onOpenChange={setIsUploadDialogOpen}
          onSuccess={handleUploadSuccess}
        />

        {/* GitHub Install Dialog - Admin Only */}
        {isAdmin && (
          <GitHubSkillInstaller
            open={isGitHubInstallOpen}
            onOpenChange={setIsGitHubInstallOpen}
            onSuccess={handleUploadSuccess}
          />
        )}
      </div>
    );
  },
});
