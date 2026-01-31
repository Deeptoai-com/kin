import { createFileRoute, Link } from '@tanstack/react-router';
import { useIntlayer } from 'react-intlayer';
import { toLocalizedString } from '~/lib/utils';
import { ArrowLeft, Upload } from 'lucide-react';
import { SkillUploadForm } from '~/components/skills/skill-upload-form';

/**
 * Skills Upload Route
 *
 * Allows users to upload custom skills with metadata and files.
 * Follows TanStack Start best practices:
 * - No loader needed (form is self-contained)
 * - Uses Server Functions for mutations
 * - Navigation on success
 */
export const Route = createFileRoute('/agents/skills/upload')({
  component: SkillsUploadPage,
});

function SkillsUploadPage() {
  const content = useIntlayer('skills-upload');

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/agents/skills"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {content.header.backLink}
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{content.header.title}</h1>
            <p className="text-muted-foreground">
              {content.header.description}
            </p>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          {content.info.title}
        </h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
          <li>{content.info.point1}</li>
          <li>{content.info.point2}</li>
          <li>{content.info.point3}</li>
          <li>{content.info.point4}</li>
        </ul>
      </div>

      {/* Upload Form */}
      <SkillUploadForm />

      {/* Help Section */}
      <div className="mt-8 rounded-lg border p-6">
        <h3 className="font-semibold mb-4">{content.help.title}</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>{toLocalizedString(content.help.skillMdFormat).split(':')[0]}:</strong> {toLocalizedString(content.help.skillMdFormat).split(':')[1] || ''}
          </p>
          <p>
            <strong>{toLocalizedString(content.help.fileStructure).split(':')[0]}:</strong> {toLocalizedString(content.help.fileStructure).split(':')[1] || ''}
          </p>
          <p>
            <strong>{toLocalizedString(content.help.resourceLimits).split(':')[0]}:</strong> {toLocalizedString(content.help.resourceLimits).split(':')[1] || ''}
          </p>
          <p>
            <strong>{toLocalizedString(content.help.securityTip).split(':')[0]}:</strong> {toLocalizedString(content.help.securityTip).split(':')[1] || ''}
          </p>
        </div>
      </div>
    </div>
  );
}
