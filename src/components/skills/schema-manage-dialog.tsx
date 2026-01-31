/**
 * Schema Manage Dialog Component
 *
 * Admin-only dialog for managing skill JSON Schema:
 * - Display schema status and metadata
 * - Show schema JSON preview
 * - Generate/Regenerate schema button
 */

import { FC, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useIntlayer } from 'react-intlayer';
import { toLocalizedString } from '~/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Checkbox } from '~/components/ui/checkbox';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Switch } from '~/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Textarea } from '~/components/ui/textarea';
import {
  getSkillSchemaStatusFn,
  generateSkillSchemaFn,
  updateSkillSchemaFn,
} from '~/server/function/skills.server';
import type { SchemaStatus, SkillInputField, SkillSchema } from '~/claude/skills';
import { FileJson, RefreshCw, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';

interface SchemaManageDialogProps {
  skillSlug: string | null;
  skillName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Schema status badge component
 */
const SchemaStatusBadge: FC<{ status: SchemaStatus; content: any }> = ({ status, content }) => {
  const config = {
    missing: {
      label: content.card.schemaStatus.missing || content.schema.statusDescriptions.missing,
      variant: 'secondary' as const,
      icon: XCircle,
      description: content.schema.statusDescriptions.missing,
    },
    valid: {
      label: content.card.schemaStatus.valid || content.schema.statusDescriptions.valid,
      variant: 'default' as const,
      icon: CheckCircle,
      description: content.schema.statusDescriptions.valid,
    },
    invalid: {
      label: content.card.schemaStatus.invalid || content.schema.statusDescriptions.invalid,
      variant: 'destructive' as const,
      icon: AlertCircle,
      description: content.schema.statusDescriptions.invalid,
    },
    stale: {
      label: content.card.schemaStatus.stale || content.schema.statusDescriptions.stale,
      variant: 'outline' as const,
      icon: Clock,
      description: content.schema.statusDescriptions.stale,
    },
    failed: {
      label: content.card.schemaStatus.failed || content.schema.statusDescriptions.failed,
      variant: 'destructive' as const,
      icon: AlertCircle,
      description: content.schema.statusDescriptions.failed,
    },
    generating: {
      label: content.schema.statusDescriptions.generating,
      variant: 'outline' as const,
      icon: RefreshCw,
      description: content.schema.statusDescriptions.generating,
    },
    // Fallback for unknown status
    unknown: {
      label: content.schema.unknown,
      variant: 'secondary' as const,
      icon: FileJson,
      description: content.schema.statusDescriptions.unknown,
    },
  };

  // Get config with fallback for unknown status
  const statusKey = (status in config ? status : 'unknown') as keyof typeof config;
  const { label, variant, icon: Icon, description } = config[statusKey];

  return (
    <Badge variant={variant} className="gap-1" title={description}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
};

/**
 * Format date to readable string
 */
const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return ''; // Return empty, will be replaced with content.schema.unknown in JSX
  return new Date(dateStr).toLocaleString('zh-CN');
};

const getOptionLabel = (option: unknown): string => {
  if (typeof option === 'string') return option;
  if (option && typeof option === 'object') {
    const value = (option as { value?: string }).value;
    const label = (option as { label?: string }).label;
    return label || value || '';
  }
  return '';
};

const getOptionValue = (option: unknown, index: number): string => {
  if (typeof option === 'string') return option;
  if (option && typeof option === 'object') {
    const value = (option as { value?: string }).value;
    const label = (option as { label?: string }).label;
    return value || label || `option-${index}`;
  }
  return `option-${index}`;
};

/**
 * Schema Manage Dialog
 */
export const SchemaManageDialog: FC<SchemaManageDialogProps> = ({
  skillSlug,
  skillName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const content = useIntlayer('skills');
  // Query schema status
  const {
    data: schemaStatus,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['schema-status', skillSlug],
    queryFn: async () => {
      if (!skillSlug) return null;
      return await getSkillSchemaStatusFn({ data: { skillSlug } });
    },
    enabled: !!skillSlug && isOpen,
  });

  // Mutation for generating/regenerating schema
  const generateMutation = useMutation({
    mutationFn: async (force: boolean) => {
      if (!skillSlug) throw new Error('skillSlug is required');
      return await generateSkillSchemaFn({
        data: { skillSlug, force },
      });
    },
    onSuccess: () => {
      // Refetch schema status
      refetchStatus();
      // Call success callback if provided
      onSuccess?.();
    },
  });

  const handleGenerate = () => {
    // Use force=true for regeneration, force=false for initial generation
    const force = schemaStatus?.status === 'valid' || schemaStatus?.status === 'stale';
    generateMutation.mutate(force);
  };

  const getStatus = (): SchemaStatus => {
    return schemaStatus?.status ?? 'missing';
  };

  const getButtonText = () => {
    const status = getStatus();
    if (status === 'missing' || status === 'invalid' || status === 'failed') {
      return content.schema.generateButton;
    }
    return content.schema.regenerateButton;
  };

  const meta = schemaStatus?.meta;
  const schema = schemaStatus?.schema ?? null;
  const needsReview = meta?.needsReview === true;

  const [editableSchema, setEditableSchema] = useState<SkillSchema | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (schema && isOpen) {
      setEditableSchema(schema);
      setIsDirty(false);
    }
  }, [schema, skillSlug, isOpen]);

  const previewInputs = editableSchema?.inputs ?? [];
  const requiredCount = useMemo(
    () => previewInputs.filter((input) => input.required).length,
    [previewInputs],
  );

  const updateField = (index: number, patch: Partial<SkillInputField>) => {
    setEditableSchema((current) => {
      if (!current?.inputs) return current;
      const inputs = [...current.inputs];
      const existing = inputs[index];
      if (!existing) return current;
      inputs[index] = { ...existing, ...patch };
      return { ...current, inputs };
    });
    setIsDirty(true);
  };

  const updateMutation = useMutation({
    mutationFn: async (schemaToSave: SkillSchema) => {
      if (!skillSlug) throw new Error('skillSlug is required');
      return await updateSkillSchemaFn({
        data: {
          skillSlug,
          schema: schemaToSave,
        },
      });
    },
    onSuccess: () => {
      refetchStatus();
      onSuccess?.();
      setIsDirty(false);
    },
  });

  const renderPreviewControl = (field: SkillInputField) => {
    const placeholder = field.placeholder ?? field.description ?? '';
    const options = field.options ?? [];

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            className="min-h-[88px]"
            placeholder={placeholder}
            disabled
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            placeholder={placeholder}
            disabled
          />
        );
      case 'select':
        return (
          <Select disabled>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={placeholder || toLocalizedString(content.schema.selectPlaceholder)} />
            </SelectTrigger>
            <SelectContent>
              {options.length === 0 ? (
                <SelectItem value="__empty__" disabled>{content.schema.noOptions}</SelectItem>
              ) : options.map((option, index) => (
                <SelectItem key={getOptionValue(option, index)} value={getOptionValue(option, index)}>
                  {getOptionLabel(option) || content.schema.optionLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'multiselect':
        return (
          <div className="grid gap-2">
            {options.length === 0 ? (
              <div className="text-xs text-muted-foreground">{content.schema.noOptions}</div>
            ) : options.map((option, index) => (
              <label
                key={getOptionValue(option, index)}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Checkbox
                  disabled
                  className="border-muted-foreground/50 bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <span>{getOptionLabel(option) || content.schema.optionLabel}</span>
              </label>
            ))}
          </div>
        );
      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <Switch disabled />
            <span className="text-xs text-muted-foreground">{content.schema.booleanLabel}</span>
          </div>
        );
      case 'file':
        return (
          <Input type="file" disabled />
        );
      case 'text':
      default:
        return (
          <Input
            type="text"
            placeholder={placeholder}
            disabled
          />
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{content.schema.title}</DialogTitle>
          <DialogDescription>
            {toLocalizedString(content.schema.description).replace('{name}', skillName)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {isLoadingStatus ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">{content.schema.loading}</span>
            </div>
          ) : schemaStatus ? (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">{content.schema.statusLabel}</span>
                <SchemaStatusBadge status={getStatus()} content={content} />
                {needsReview && (
                  <Badge variant="destructive" className="gap-1" title="需要人工校验">
                    <AlertCircle className="h-3 w-3" />
                    {content.schema.needsReview}
                  </Badge>
                )}
              </div>

              {/* Metadata Info */}
              {meta && (
                <div className="space-y-2 rounded-lg border bg-muted/50 p-3 max-w-full">
                  <div className="text-sm font-medium">{content.schema.metadata}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs min-w-0">
                    <div className="min-w-0">
                      <span className="text-muted-foreground">{content.schema.generatedAt}</span>
                      <div className="mt-1 font-mono break-words">{formatDate(meta.generatedAt) || content.schema.unknown}</div>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground">{content.schema.lastAttempt}</span>
                      <div className="mt-1 font-mono break-words">{formatDate(meta.lastAttemptAt ?? meta.generatedAt) || content.schema.unknown}</div>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground">{content.schema.generatedBy}</span>
                      <div className="mt-1 break-all">{meta.generatedBy || content.schema.unknown}</div>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground">{content.schema.model}</span>
                      <div className="mt-1 break-all">{meta.model || content.schema.unknown}</div>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground">{content.schema.skillMdHash}</span>
                      <div className="mt-1 font-mono text-xs break-all">
                        {meta.skillMdHash || content.schema.unknown}
                      </div>
                    </div>
                  </div>
                  {meta.lastError && (
                    <div className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                      <div className="font-medium mb-1">{content.schema.lastError}</div>
                      <div className="font-mono break-words">{meta.lastError}</div>
                    </div>
                  )}
                  {needsReview && (
                    <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-2 text-xs text-amber-800 dark:text-amber-400">
                      {content.schema.reviewWarning}
                    </div>
                  )}
                </div>
              )}

              {/* Schema Preview / Form Preview */}
              {schema && (
                <div className="space-y-2">
                  <Tabs defaultValue="preview" className="w-full">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <TabsList>
                        <TabsTrigger value="preview">{content.schema.formPreview}</TabsTrigger>
                        <TabsTrigger value="json">{content.schema.jsonPreview}</TabsTrigger>
                      </TabsList>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileJson className="h-4 w-4" />
                        {previewInputs.length > 0 ? (
                          <span>{toLocalizedString(content.schema.fieldCount).replace('{count}', String(previewInputs.length)).replace('{required}', String(requiredCount))}</span>
                        ) : (
                          <span>{content.schema.noFields}</span>
                        )}
                      </div>
                    </div>

                    <TabsContent value="preview" className="space-y-3">
                      {editableSchema?.inputs && editableSchema.inputs.length > 0 ? (
                        <div className="space-y-3">
                          {editableSchema.inputs.map((field, index) => (
                            <div
                              key={`${field.name}-${index}`}
                              className="rounded-md border bg-muted/30 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{field.label || field.name}</span>
                                    <Badge variant="outline" className="text-[10px] uppercase">
                                      {field.type}
                                    </Badge>
                                  </div>
                                  {field.description && (
                                    <div className="text-xs text-muted-foreground break-words">{field.description}</div>
                                  )}
                                </div>
                                <label className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                                  <Checkbox
                                    checked={field.required}
                                    onCheckedChange={(checked) => updateField(index, { required: checked === true })}
                                    className="border-muted-foreground/50 bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                  />
                                  {content.schema.required}
                                </label>
                              </div>
                              <div className="mt-3">{renderPreviewControl(field)}</div>
                              {field.placeholder && (
                                <div className="mt-2 text-[11px] text-muted-foreground break-words">
                                  <span className="font-medium">{content.schema.placeholderLabel}</span> {field.placeholder}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                          {content.schema.noFieldsPreview}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="json" className="space-y-2">
                      <div className="h-48 w-full max-w-full overflow-auto rounded-md border bg-muted/50 p-3">
                        <pre className="text-xs font-mono whitespace-pre">
                          {JSON.stringify(editableSchema ?? schema, null, 2)}
                        </pre>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {/* Cost Warning */}
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs">
                <div className="font-medium text-amber-800 dark:text-amber-400 mb-1">
                  {toLocalizedString(content.schema.costWarning).split(':')[0]}
                </div>
                <div className="text-amber-700 dark:text-amber-500">
                  {toLocalizedString(content.schema.costWarning).split(':')[1] || toLocalizedString(content.schema.costWarning)}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {content.schema.closeButton}
          </Button>
          <Button
            variant="secondary"
            onClick={() => editableSchema && updateMutation.mutate(editableSchema)}
            disabled={!editableSchema || !isDirty || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {content.schema.saving}
              </>
            ) : (
              content.schema.saveButton
            )}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || isLoadingStatus}
          >
            {generateMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {content.schema.generating}
              </>
            ) : (
              getButtonText()
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
