import { FC, useState } from 'react';
import { useIntlayer } from 'react-intlayer';
import { toLocalizedString } from '~/lib/utils';
import { useServerFn } from '@tanstack/react-start';
import { uploadUserSkillFn } from '~/server/function/skills.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import { Plus, Trash2, Upload, FileCode } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

interface SkillFile {
  path: string;
  content: string;
}

interface SkillUploadFormProps {
  onSuccess?: () => void;
}

/**
 * Skills Upload Form Component
 *
 * Allows users to upload custom skills with metadata and files.
 * Follows TanStack Start best practices with Server Functions.
 */
export const SkillUploadForm: FC<SkillUploadFormProps> = ({ onSuccess }) => {
  const content = useIntlayer('skills-upload');
  const navigate = useNavigate();
  const uploadSkill = useServerFn(uploadUserSkillFn);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('productivity');
  const [files, setFiles] = useState<SkillFile[]>([
    { path: 'SKILL.md', content: defaultSkillTemplate }
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add new file
  const handleAddFile = () => {
    const newFileName = `file-${files.length}.md`;
    setFiles([...files, { path: newFileName, content: '' }]);
  };

  // Remove file
  const handleRemoveFile = (index: number) => {
    if (files.length === 1) {
      setError(toLocalizedString(content.errors.minOneFile));
      return;
    }
    setFiles(files.filter((_, i) => i !== index));
  };

  // Update file path
  const handleUpdateFilePath = (index: number, newPath: string) => {
    const updated = [...files];
    updated[index].path = newPath;
    setFiles(updated);
  };

  // Update file content
  const handleUpdateFileContent = (index: number, newContent: string) => {
    const updated = [...files];
    updated[index].content = newContent;
    setFiles(updated);
  };

  // Validate form
  const validateForm = (): string | null => {
    if (!name.trim()) {
      return content.errors.nameRequired;
    }
    if (name.length > 50) {
      return content.errors.nameTooLong;
    }
    if (files.length === 0) {
      return content.errors.minOneFileRequired;
    }
    if (files.length > 100) {
      return content.errors.maxFilesExceeded;
    }
    const totalSize = files.reduce((sum, f) => sum + f.content.length, 0);
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (totalSize > maxSize) {
      return toLocalizedString(content.errors.maxSizeExceeded).replace('{size}', (totalSize / 1024 / 1024).toFixed(2));
    }
    for (const file of files) {
      if (!file.path.trim()) {
        return content.errors.emptyPath;
      }
      if (file.path.includes('..')) {
        return content.errors.noParentDir;
      }
    }
    return null;
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);

    try {
      await uploadSkill({
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          category: category.trim() || 'productivity',
          files: files.map(f => ({
            path: f.path.trim(),
            content: f.content,
          })),
        },
      });

      // Success: navigate back to skills list
      navigate({ to: '/agents/skills' });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : toLocalizedString(content.errors.uploadFailed));
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle>{content.metadata.title}</CardTitle>
          <CardDescription>
            {content.metadata.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              {content.metadata.nameLabel} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={toLocalizedString(content.metadata.namePlaceholder)}
              disabled={isUploading}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              {toLocalizedString(content.metadata.nameCounter).replace('{count}', String(name.length))}
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{content.metadata.descriptionLabel}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={toLocalizedString(content.metadata.descriptionPlaceholder)}
              disabled={isUploading}
              rows={3}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">{content.metadata.categoryLabel}</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isUploading}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="development">{content.categories.development}</option>
              <option value="productivity">{content.categories.productivity}</option>
              <option value="design">{content.categories.design}</option>
              <option value="integration">{content.categories.integration}</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Files Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{content.files.title}</CardTitle>
              <CardDescription>
                {content.files.description}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddFile}
              disabled={isUploading}
            >
              <Plus className="h-4 w-4 mr-2" />
              {content.files.addButton}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {files.map((file, index) => (
            <div key={index} className="space-y-2 rounded-lg border p-4">
              {/* File Header */}
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={file.path}
                  onChange={(e) => handleUpdateFilePath(index, e.target.value)}
                  placeholder={toLocalizedString(content.files.filePlaceholder)}
                  disabled={isUploading}
                  className="flex-1"
                />
                {files.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(index)}
                    disabled={isUploading}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* File Content */}
              <Textarea
                value={file.content}
                onChange={(e) => handleUpdateFileContent(index, e.target.value)}
                placeholder={toLocalizedString(content.files.contentPlaceholder).replace('{path}', file.path)}
                disabled={isUploading}
                rows={file.path === 'SKILL.md' ? 15 : 8}
                className="font-mono text-sm"
              />

              {/* File Size */}
              <p className="text-xs text-muted-foreground text-right">
                {(file.content.length / 1024).toFixed(2)} KB
              </p>
            </div>
          ))}

          {/* Total Size */}
          <div className="text-sm text-muted-foreground">
            {toLocalizedString(content.files.totalSize)
              .replace('{size}', (files.reduce((sum, f) => sum + f.content.length, 0) / 1024).toFixed(2))
              .replace('{count}', String(files.length))}
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: '/agents/skills' })}
          disabled={isUploading}
        >
          {content.buttons.cancel}
        </Button>
        <Button
          type="submit"
          disabled={isUploading}
          className="min-w-[120px]"
        >
          {isUploading ? (
            <>{content.buttons.uploading}</>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              {content.buttons.submit}
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

// Default SKILL.md template
const defaultSkillTemplate = `---
name: My Custom Skill
description: A brief description of what this skill does
category: productivity
---

# My Custom Skill

Provide detailed instructions for Claude here.

## Usage

When to use this skill and how it works.

## Examples

Example usage scenarios.
`.trim();
