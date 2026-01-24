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
const SchemaStatusBadge: FC<{ status: SchemaStatus }> = ({ status }) => {
  const config = {
    missing: {
      label: 'Missing',
      variant: 'secondary' as const,
      icon: XCircle,
      description: 'Schema 未生成',
    },
    valid: {
      label: 'Valid',
      variant: 'default' as const,
      icon: CheckCircle,
      description: 'Schema 有效且最新',
    },
    invalid: {
      label: 'Invalid',
      variant: 'destructive' as const,
      icon: AlertCircle,
      description: 'Schema 存在但解析失败',
    },
    stale: {
      label: 'Stale',
      variant: 'outline' as const,
      icon: Clock,
      description: 'Schema 过期，SKILL.md 已更新',
    },
    failed: {
      label: 'Failed',
      variant: 'destructive' as const,
      icon: AlertCircle,
      description: '上次生成失败',
    },
    generating: {
      label: 'Generating',
      variant: 'outline' as const,
      icon: RefreshCw,
      description: '正在生成 Schema...',
    },
    // Fallback for unknown status
    unknown: {
      label: 'Unknown',
      variant: 'secondary' as const,
      icon: FileJson,
      description: 'Schema 状态未知',
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
  if (!dateStr) return '未知';
  return new Date(dateStr).toLocaleString('zh-CN');
};

const getOptionLabel = (option: unknown): string => {
  if (typeof option === 'string') return option;
  if (option && typeof option === 'object') {
    const value = (option as { value?: string }).value;
    const label = (option as { label?: string }).label;
    return label || value || '选项';
  }
  return '选项';
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
      return '生成 Schema';
    }
    return '重新生成';
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
              <SelectValue placeholder={placeholder || '请选择'} />
            </SelectTrigger>
            <SelectContent>
              {options.length === 0 ? (
                <SelectItem value="__empty__" disabled>无可选项</SelectItem>
              ) : options.map((option, index) => (
                <SelectItem key={getOptionValue(option, index)} value={getOptionValue(option, index)}>
                  {getOptionLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'multiselect':
        return (
          <div className="grid gap-2">
            {options.length === 0 ? (
              <div className="text-xs text-muted-foreground">无可选项</div>
            ) : options.map((option, index) => (
              <label
                key={getOptionValue(option, index)}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Checkbox
                  disabled
                  className="border-muted-foreground/50 bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <span>{getOptionLabel(option)}</span>
              </label>
            ))}
          </div>
        );
      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <Switch disabled />
            <span className="text-xs text-muted-foreground">是 / 否</span>
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
          <DialogTitle>Schema 管理</DialogTitle>
          <DialogDescription>
            管理 <code>{skillName}</code> 的 JSON Schema
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {isLoadingStatus ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">加载中...</span>
            </div>
          ) : schemaStatus ? (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">状态:</span>
                <SchemaStatusBadge status={getStatus()} />
                {needsReview && (
                  <Badge variant="destructive" className="gap-1" title="需要人工校验">
                    <AlertCircle className="h-3 w-3" />
                    需人工校验
                  </Badge>
                )}
              </div>

              {/* Metadata Info */}
              {meta && (
                <div className="space-y-2 rounded-lg border bg-muted/50 p-3 max-w-full">
                  <div className="text-sm font-medium">元数据</div>
                  <div className="grid grid-cols-2 gap-2 text-xs min-w-0">
                    <div className="min-w-0">
                      <span className="text-muted-foreground">生成时间:</span>
                      <div className="mt-1 font-mono break-words">{formatDate(meta.generatedAt)}</div>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground">上次尝试:</span>
                      <div className="mt-1 font-mono break-words">{formatDate(meta.lastAttemptAt ?? meta.generatedAt)}</div>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground">生成者:</span>
                      <div className="mt-1 break-all">{meta.generatedBy || '未知'}</div>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground">模型:</span>
                      <div className="mt-1 break-all">{meta.model || '未知'}</div>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground">SKILL.md Hash:</span>
                      <div className="mt-1 font-mono text-xs break-all">
                        {meta.skillMdHash || '未知'}
                      </div>
                    </div>
                  </div>
                  {meta.lastError && (
                    <div className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                      <div className="font-medium mb-1">上次错误:</div>
                      <div className="font-mono break-words">{meta.lastError}</div>
                    </div>
                  )}
                  {needsReview && (
                    <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-2 text-xs text-amber-800 dark:text-amber-400">
                      该 Schema 由容错模式生成，请人工核对后再使用。
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
                        <TabsTrigger value="preview">表单预览</TabsTrigger>
                        <TabsTrigger value="json">JSON 预览</TabsTrigger>
                      </TabsList>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileJson className="h-4 w-4" />
                        {previewInputs.length > 0 ? (
                          <span>字段数: {previewInputs.length}（必填 {requiredCount}）</span>
                        ) : (
                          <span>暂无输入字段</span>
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
                                  必填
                                </label>
                              </div>
                              <div className="mt-3">{renderPreviewControl(field)}</div>
                              {field.placeholder && (
                                <div className="mt-2 text-[11px] text-muted-foreground break-words">
                                  <span className="font-medium">占位提示:</span> {field.placeholder}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                          暂无可预览的输入字段
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
                  注意
                </div>
                <div className="text-amber-700 dark:text-amber-500">
                  生成/重新生成 Schema 会调用 AI API，会产生费用。建议仅在必要时操作。
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          <Button
            variant="secondary"
            onClick={() => editableSchema && updateMutation.mutate(editableSchema)}
            disabled={!editableSchema || !isDirty || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              '保存修改'
            )}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || isLoadingStatus}
          >
            {generateMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                生成中...
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
