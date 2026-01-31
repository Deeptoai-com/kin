import { FC, useState, useCallback } from 'react';
import { useIntlayer } from 'react-intlayer';
import { toLocalizedString } from '~/lib/utils';
import { useServerFn } from '@tanstack/react-start';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import {
  FileText,
  Code,
  Link,
  Package,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Globe,
  User,
} from 'lucide-react';
import {
  addCustomMcpFn,
  parseMcpConfigFn,
  fetchMcpFromUrlFn,
  parseNpmPackageFn,
} from '~/server/function/mcp.server';

// ============================================================================
// Example configurations for guidance
// ============================================================================

// Hardcoded example values (not translated)
const EXAMPLE_CONFIG = {
  slug: 'zai-vision',
  name: 'Z.AI Vision Server',
  description: 'GLM-4.6V visual understanding capabilities',
  category: 'development',
  type: 'stdio' as const,
  command: 'npx',
  args: '-y @z_ai/mcp-server',
  envVars: [{ key: 'Z_AI_API_KEY', value: '${Z_AI_API_KEY}' }],
  credentials: [
    { key: 'Z_AI_API_KEY', label: 'Z.AI API Key', required: true, sensitive: true },
  ],
};

const JSON_EXAMPLE = `name: my-custom-mcp
description: My custom MCP server
category: development

mcp:
  type: stdio
  command: npx
  args: ['-y', '@my-org/mcp-server']
  env:
    API_KEY: "\${API_KEY}"

credentials:
  - key: API_KEY
    label: API Key
    required: true
    sensitive: true`;

const URL_EXAMPLE = 'https://raw.githubusercontent.com/user/repo/main/MCP.md';
const NPM_EXAMPLE = '@modelcontextprotocol/server-github';

// ============================================================================
// Types
// ============================================================================

interface EnvVar {
  key: string;
  value: string;
}

interface CredentialField {
  key: string;
  label: string;
  description?: string;
  required: boolean;
  sensitive: boolean;
}

interface FormState {
  slug: string;
  name: string;
  description: string;
  category: string;
  scope: 'personal' | 'system';
  type: 'stdio' | 'http' | 'sse';
  command: string;
  args: string;
  url: string;
  envVars: EnvVar[];
  headers: EnvVar[];
  credentials: CredentialField[];
}

const initialFormState: FormState = {
  slug: '',
  name: '',
  description: '',
  category: 'general',
  scope: 'personal',
  type: 'stdio',
  command: '',
  args: '',
  url: '',
  envVars: [],
  headers: [],
  credentials: [],
};

// ============================================================================
// Component
// ============================================================================

export const AddCustomMcpDialog: FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ isOpen, onClose, onSuccess }) => {
  const content = useIntlayer('mcp');
  const addCustomMcp = useServerFn(addCustomMcpFn);
  const parseMcpConfig = useServerFn(parseMcpConfigFn);
  const fetchMcpFromUrl = useServerFn(fetchMcpFromUrlFn);
  const parseNpmPackage = useServerFn(parseNpmPackageFn);

  const [activeTab, setActiveTab] = useState('form');
  const [form, setForm] = useState<FormState>(initialFormState);
  const [jsonContent, setJsonContent] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [npmPackage, setNpmPackage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);

  const resetState = useCallback(() => {
    setForm(initialFormState);
    setJsonContent('');
    setImportUrl('');
    setNpmPackage('');
    setError(null);
    setSuccess(null);
    setShowExample(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    }));
  };

  // Add environment variable
  const addEnvVar = () => {
    setForm((prev) => ({
      ...prev,
      envVars: [...prev.envVars, { key: '', value: '' }],
    }));
  };

  const removeEnvVar = (index: number) => {
    setForm((prev) => ({
      ...prev,
      envVars: prev.envVars.filter((_, i) => i !== index),
    }));
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    setForm((prev) => ({
      ...prev,
      envVars: prev.envVars.map((ev, i) => (i === index ? { ...ev, [field]: value } : ev)),
    }));
  };

  // Add credential field
  const addCredential = () => {
    setForm((prev) => ({
      ...prev,
      credentials: [...prev.credentials, { key: '', label: '', required: true, sensitive: true }],
    }));
  };

  const removeCredential = (index: number) => {
    setForm((prev) => ({
      ...prev,
      credentials: prev.credentials.filter((_, i) => i !== index),
    }));
  };

  const updateCredential = (index: number, field: keyof CredentialField, value: unknown) => {
    setForm((prev) => ({
      ...prev,
      credentials: prev.credentials.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }));
  };

  // Build MCP data from form
  const buildMcpData = () => {
    const envObj: Record<string, string> = {};
    for (const { key, value } of form.envVars) {
      if (key.trim()) envObj[key] = value;
    }

    const headersObj: Record<string, string> = {};
    for (const { key, value } of form.headers) {
      if (key.trim()) headersObj[key] = value;
    }

    const mcp: Record<string, unknown> = { type: form.type };

    if (form.type === 'stdio') {
      mcp.command = form.command;
      if (form.args.trim()) {
        mcp.args = form.args.split(/[,\s]+/).filter(Boolean);
      }
      if (Object.keys(envObj).length > 0) {
        mcp.env = envObj;
      }
    } else {
      mcp.url = form.url;
      if (Object.keys(headersObj).length > 0) {
        mcp.headers = headersObj;
      }
    }

    return {
      slug: form.slug,
      name: form.name,
      description: form.description || null,
      category: form.category,
      scope: form.scope,
      mcp,
      credentials: form.credentials.length > 0 ? form.credentials : null,
    };
  };

  // Submit form
  const handleSubmitForm = async () => {
    setError(null);
    setSuccess(null);

    if (!form.slug || !form.name) {
      setError(toLocalizedString(content.addDialog.errors.slugNameRequired));
      return;
    }

    if (form.type === 'stdio' && !form.command) {
      setError(toLocalizedString(content.addDialog.errors.commandRequired));
      return;
    }

    if ((form.type === 'http' || form.type === 'sse') && !form.url) {
      setError(toLocalizedString(content.addDialog.errors.urlRequired));
      return;
    }

    setIsLoading(true);
    try {
      const result = await addCustomMcp({ data: buildMcpData() });
      if (result.ok) {
        const scopeLabel = result.scope === 'system' ? content.addDialog.success.scopeSystem : content.addDialog.success.scopePersonal;
        setSuccess(toLocalizedString(content.addDialog.success.added).replace('{slug}', result.slug).replace('{scope}', toLocalizedString(scopeLabel)));
        setTimeout(() => {
          handleClose();
          onSuccess();
        }, 1000);
      } else {
        setError(result.error || toLocalizedString(content.addDialog.errors.failedToAdd));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : toLocalizedString(content.addDialog.errors.anErrorOccurred));
    } finally {
      setIsLoading(false);
    }
  };

  // Parse JSON/YAML content
  const handleParseJson = async () => {
    setError(null);
    if (!jsonContent.trim()) {
      setError(toLocalizedString(content.addDialog.errors.pasteContent));
      return;
    }

    setIsLoading(true);
    try {
      const result = await parseMcpConfig({ data: { content: jsonContent } });
      if (result.ok && result.data) {
        populateFormFromParsed(result.data);
        setActiveTab('form');
        setSuccess(toLocalizedString(content.addDialog.success.parsed));
      } else {
        setError(result.error || toLocalizedString(content.addDialog.errors.parseFailed));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : toLocalizedString(content.addDialog.errors.parseError));
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch from URL
  const handleFetchUrl = async () => {
    setError(null);
    if (!importUrl.trim()) {
      setError(toLocalizedString(content.addDialog.errors.enterUrl));
      return;
    }

    setIsLoading(true);
    try {
      const result = await fetchMcpFromUrl({ data: { url: importUrl } });
      if (result.ok && result.data) {
        populateFormFromParsed(result.data);
        setActiveTab('form');
        setSuccess(toLocalizedString(content.addDialog.success.imported));
      } else {
        setError(result.error || toLocalizedString(content.addDialog.errors.fetchFailed));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : toLocalizedString(content.addDialog.errors.fetchError));
    } finally {
      setIsLoading(false);
    }
  };

  // Parse npm package
  const handleParseNpm = async () => {
    setError(null);
    if (!npmPackage.trim()) {
      setError(toLocalizedString(content.addDialog.errors.enterPackage));
      return;
    }

    setIsLoading(true);
    try {
      const result = await parseNpmPackage({ data: { packageName: npmPackage } });
      if (result.ok && result.suggestedConfig) {
        const config = result.suggestedConfig;
        setForm((prev) => ({
          ...prev,
          slug: config.slug,
          name: config.name,
          description: config.description || '',
          type: 'stdio',
          command: config.mcp.command,
          args: config.mcp.args?.join(' ') || '',
        }));
        setActiveTab('form');
        setSuccess(toLocalizedString(content.addDialog.success.packageLoaded));
      } else {
        setError(result.error || toLocalizedString(content.addDialog.errors.npmParseFailed));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : toLocalizedString(content.addDialog.errors.npmError));
    } finally {
      setIsLoading(false);
    }
  };

  // Populate form from parsed data
  const populateFormFromParsed = (data: Record<string, unknown>) => {
    const mcp = (data.mcp || {}) as Record<string, unknown>;
    const credentials = (data.credentials || []) as CredentialField[];
    const env = (mcp.env || {}) as Record<string, string>;

    setForm((prev) => ({
      slug: String(data.slug || data.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: String(data.name || ''),
      description: String(data.description || ''),
      category: String(data.category || 'general'),
      scope: prev.scope ?? 'personal',
      type: (mcp.type as 'stdio' | 'http' | 'sse') || 'stdio',
      command: String(mcp.command || ''),
      args: Array.isArray(mcp.args) ? mcp.args.join(' ') : '',
      url: String(mcp.url || ''),
      envVars: Object.entries(env).map(([key, value]) => ({ key, value })),
      headers: [],
      credentials: credentials.map((c) => ({
        key: c.key,
        label: c.label || c.key,
        description: c.description,
        required: c.required ?? true,
        sensitive: c.sensitive ?? true,
      })),
    }));
  };

  // Load example into form
  const loadFormExample = () => {
    const ex = EXAMPLE_CONFIG;
    setForm((prev) => ({
      slug: ex.slug,
      name: ex.name,
      description: ex.description,
      category: ex.category,
      scope: prev.scope ?? 'personal',
      type: ex.type as 'stdio',
      command: ex.command,
      args: ex.args,
      url: '',
      envVars: ex.envVars,
      headers: [],
      credentials: ex.credentials,
    }));
    setShowExample(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{toLocalizedString(content.addDialog.title)}</DialogTitle>
          <DialogDescription>
            {toLocalizedString(content.addDialog.description)}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-300">{success}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="form" className="text-xs">
              <FileText className="mr-1 h-3 w-3" />
              {toLocalizedString(content.addDialog.tabs.form)}
            </TabsTrigger>
            <TabsTrigger value="json" className="text-xs">
              <Code className="mr-1 h-3 w-3" />
              {toLocalizedString(content.addDialog.tabs.yamlJson)}
            </TabsTrigger>
            <TabsTrigger value="url" className="text-xs">
              <Link className="mr-1 h-3 w-3" />
              {toLocalizedString(content.addDialog.tabs.url)}
            </TabsTrigger>
            <TabsTrigger value="npm" className="text-xs">
              <Package className="mr-1 h-3 w-3" />
              {toLocalizedString(content.addDialog.tabs.npm)}
            </TabsTrigger>
          </TabsList>

          {/* Form Tab */}
          <TabsContent value="form" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{toLocalizedString(content.addDialog.form.manual)}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExample(!showExample)}
                className="text-xs"
              >
                {showExample ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
                {toLocalizedString(content.addDialog.form.example)}
              </Button>
            </div>

            {showExample && (
              <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{toLocalizedString(content.addDialog.form.exampleTitle)}</span>
                  <Button variant="outline" size="sm" onClick={loadFormExample}>
                    {toLocalizedString(content.addDialog.form.useExample)}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{toLocalizedString(content.addDialog.form.exampleDescription)}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{toLocalizedString(content.addDialog.form.nameLabel)} *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={toLocalizedString(content.addDialog.form.namePlaceholder)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">{toLocalizedString(content.addDialog.form.slugLabel)} *</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder={toLocalizedString(content.addDialog.form.slugPlaceholder)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{toLocalizedString(content.addDialog.form.descriptionLabel)}</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={toLocalizedString(content.addDialog.form.descriptionPlaceholder)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{toLocalizedString(content.addDialog.form.categoryLabel)}</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">{toLocalizedString(content.addDialog.form.categoryGeneral)}</SelectItem>
                    <SelectItem value="development">{toLocalizedString(content.addDialog.form.categoryDevelopment)}</SelectItem>
                    <SelectItem value="data">{toLocalizedString(content.addDialog.form.categoryData)}</SelectItem>
                    <SelectItem value="integration">{toLocalizedString(content.addDialog.form.categoryIntegration)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{toLocalizedString(content.addDialog.form.connectionTypeLabel)}</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, type: value as 'stdio' | 'http' | 'sse' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stdio">{toLocalizedString(content.addDialog.form.typeStdio)}</SelectItem>
                    <SelectItem value="http">{toLocalizedString(content.addDialog.form.typeHttp)}</SelectItem>
                    <SelectItem value="sse">{toLocalizedString(content.addDialog.form.typeSse)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Visibility/Scope Selection */}
            <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
              <Label className="text-sm font-medium">{toLocalizedString(content.addDialog.form.visibility)}</Label>
              <RadioGroup
                value={form.scope}
                onValueChange={(value) => setForm((prev) => ({ ...prev, scope: value as 'personal' | 'system' }))}
                className="space-y-2"
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="personal" id="scope-personal" className="mt-1" />
                  <div className="flex-1">
                    <label htmlFor="scope-personal" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {toLocalizedString(content.addDialog.form.visibilityPersonal)}
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {toLocalizedString(content.addDialog.form.visibilityPersonalDesc)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="system" id="scope-system" className="mt-1" />
                  <div className="flex-1">
                    <label htmlFor="scope-system" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <Globe className="h-4 w-4 text-blue-500" />
                      {toLocalizedString(content.addDialog.form.visibilitySystem)}
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {toLocalizedString(content.addDialog.form.visibilitySystemDesc)}
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {form.type === 'stdio' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="command">{toLocalizedString(content.addDialog.form.commandLabel)} *</Label>
                  <Input
                    id="command"
                    value={form.command}
                    onChange={(e) => setForm((prev) => ({ ...prev, command: e.target.value }))}
                    placeholder={toLocalizedString(content.addDialog.form.commandPlaceholder)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="args">{toLocalizedString(content.addDialog.form.argsLabel)}</Label>
                  <Input
                    id="args"
                    value={form.args}
                    onChange={(e) => setForm((prev) => ({ ...prev, args: e.target.value }))}
                    placeholder={toLocalizedString(content.addDialog.form.argsPlaceholder)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{toLocalizedString(content.addDialog.form.envVarsLabel)}</Label>
                    <Button variant="ghost" size="sm" onClick={addEnvVar}>
                      <Plus className="h-3 w-3 mr-1" />
                      {toLocalizedString(content.addDialog.form.addEnvVar)}
                    </Button>
                  </div>
                  {form.envVars.map((ev, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder={toLocalizedString(content.addDialog.form.keyPlaceholder)}
                        value={ev.key}
                        onChange={(e) => updateEnvVar(i, 'key', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder={toLocalizedString(content.addDialog.form.valuePlaceholder)}
                        value={ev.value}
                        onChange={(e) => updateEnvVar(i, 'value', e.target.value)}
                        className="flex-1"
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeEnvVar(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="url">{toLocalizedString(content.addDialog.form.urlLabel)} *</Label>
                <Input
                  id="url"
                  value={form.url}
                  onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                  placeholder={toLocalizedString(content.addDialog.form.urlPlaceholder)}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{toLocalizedString(content.addDialog.form.credentialsLabel)}</Label>
                <Button variant="ghost" size="sm" onClick={addCredential}>
                  <Plus className="h-3 w-3 mr-1" />
                  {toLocalizedString(content.addDialog.form.addEnvVar)}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {toLocalizedString(content.addDialog.form.credentialsHint)}
              </p>
              {form.credentials.map((cred, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Input
                    placeholder={toLocalizedString(content.addDialog.form.keyPlaceholderShort)}
                    value={cred.key}
                    onChange={(e) => updateCredential(i, 'key', e.target.value)}
                    className="w-28"
                  />
                  <Input
                    placeholder={toLocalizedString(content.addDialog.form.labelPlaceholder)}
                    value={cred.label}
                    onChange={(e) => updateCredential(i, 'label', e.target.value)}
                    className="flex-1"
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={cred.required}
                      onChange={(e) => updateCredential(i, 'required', e.target.checked)}
                    />
                    {toLocalizedString(content.addDialog.form.required)}
                  </label>
                  <Button variant="ghost" size="icon" onClick={() => removeCredential(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                {toLocalizedString(content.addDialog.form.cancelButton)}
              </Button>
              <Button onClick={handleSubmitForm} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {toLocalizedString(content.addDialog.form.addButton)}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* JSON/YAML Tab */}
          <TabsContent value="json" className="space-y-4 mt-4">
            <div className="rounded-lg border bg-muted/50 p-3 text-sm">
              <p className="font-medium mb-2">{toLocalizedString(content.addDialog.json.title)}</p>
              <p className="text-xs text-muted-foreground mb-2">{toLocalizedString(content.addDialog.json.description)}</p>
              <details className="text-xs">
                <summary className="cursor-pointer text-primary hover:underline">{toLocalizedString(content.addDialog.json.viewExample)}</summary>
                <pre className="mt-2 p-2 bg-background rounded text-xs overflow-x-auto">
                  {JSON_EXAMPLE}
                </pre>
              </details>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jsonContent">{toLocalizedString(content.addDialog.json.configLabel)}</Label>
              <Textarea
                id="jsonContent"
                value={jsonContent}
                onChange={(e) => setJsonContent(e.target.value)}
                placeholder={toLocalizedString(content.addDialog.json.configPlaceholder)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                {toLocalizedString(content.addDialog.form.cancelButton)}
              </Button>
              <Button onClick={handleParseJson} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {toLocalizedString(content.addDialog.json.parseButton)}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* URL Tab */}
          <TabsContent value="url" className="space-y-4 mt-4">
            <div className="rounded-lg border bg-muted/50 p-3 text-sm">
              <p className="font-medium mb-2">{toLocalizedString(content.addDialog.url.title)}</p>
              <p className="text-xs text-muted-foreground mb-2">{toLocalizedString(content.addDialog.url.description)}</p>
              <p className="text-xs font-mono text-muted-foreground">{URL_EXAMPLE}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="importUrl">{toLocalizedString(content.addDialog.url.urlLabel)}</Label>
              <Input
                id="importUrl"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder={toLocalizedString(content.addDialog.url.urlPlaceholder)}
              />
              <p className="text-xs text-muted-foreground">
                {toLocalizedString(content.addDialog.url.urlHint)}
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                {toLocalizedString(content.addDialog.form.cancelButton)}
              </Button>
              <Button onClick={handleFetchUrl} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {toLocalizedString(content.addDialog.url.fetchButton)}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* npm Tab */}
          <TabsContent value="npm" className="space-y-4 mt-4">
            <div className="rounded-lg border bg-muted/50 p-3 text-sm">
              <p className="font-medium mb-2">{toLocalizedString(content.addDialog.npm.title)}</p>
              <p className="text-xs text-muted-foreground mb-2">{toLocalizedString(content.addDialog.npm.description)}</p>
              <p className="text-xs font-mono text-muted-foreground">{NPM_EXAMPLE}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="npmPackage">{toLocalizedString(content.addDialog.npm.packageLabel)}</Label>
              <Input
                id="npmPackage"
                value={npmPackage}
                onChange={(e) => setNpmPackage(e.target.value)}
                placeholder={toLocalizedString(content.addDialog.npm.packagePlaceholder)}
              />
              <p className="text-xs text-muted-foreground">
                {toLocalizedString(content.addDialog.npm.packageHint)}
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                {toLocalizedString(content.addDialog.form.cancelButton)}
              </Button>
              <Button onClick={handleParseNpm} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {toLocalizedString(content.addDialog.npm.detectButton)}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
