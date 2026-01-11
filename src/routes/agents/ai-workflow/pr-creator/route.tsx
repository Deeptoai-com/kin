/**
 * PR Creator Workflow Page
 *
 * 多步骤的 PR 稿件创作流程：
 * 1. 输入 Brief 和 Facts
 * 2. AI 分析并提出澄清问题
 * 3. 用户回答问题
 * 4. AI 生成稿件
 * 5. 审批/修改
 * 6. 最终输出
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { AuthLoading, RedirectToSignIn, SignedIn } from '@daveyplate/better-auth-ui';
import { useState, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Send,
  FileText,
  MessageSquare,
  CheckCircle,
  Check,
  Loader2,
  AlertCircle,
  Copy,
  Download,
  RotateCcw,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Badge } from '~/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Separator } from '~/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';

export const Route = createFileRoute('/agents/ai-workflow/pr-creator')({
  component: RouteComponent,
});

// ============================================================================
// Types
// ============================================================================

type WorkflowStep = 'input' | 'analyzing' | 'clarify' | 'generating' | 'review' | 'done';

interface BriefData {
  client: string;
  project: string;
  objective: string;
  targetMedia: string[];
  targetAudience: string;
  tone: string;
}

interface FactsData {
  rawContent: string; // 原始素材文本，可直接粘贴品牌方文档
}

// 支持的语言列表
const SUPPORTED_LANGUAGES = [
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'uz', name: "O'zbek", flag: '🇺🇿' },
] as const;

// 字数范围选项
const WORD_COUNT_OPTIONS = [
  { value: '500-800', label: '500-800 字（简短）' },
  { value: '800-1200', label: '800-1200 字（标准）' },
  { value: '1200-1800', label: '1200-1800 字（详细）' },
  { value: '1800-2500', label: '1800-2500 字（深度）' },
] as const;

interface OutputConfig {
  wordCountRange: string;
  languages: string[]; // 最多3种语言代码
}

interface Question {
  id: string;
  question: string;
  importance: 'high' | 'medium' | 'low';
  context: string;
}

interface AnalysisResult {
  strengths: string[];
  gaps: string[];
  suggestedAngle: string;
  questions: Question[];
  canProceedWithoutClarification: boolean;
}

interface PRDraft {
  title: string;
  subtitle?: string;
  lead: string;
  body: string;
  boilerplate: string;
  keyMessages: string[];
}

// ============================================================================
// Main Component
// ============================================================================

function RouteComponent() {
  return (
    <div className="container mx-auto h-full px-4 py-6">
      <AuthLoading>
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          正在检查登录状态…
        </div>
      </AuthLoading>

      <RedirectToSignIn />

      <SignedIn>
        <PRCreatorWorkflow />
      </SignedIn>
    </div>
  );
}

function PRCreatorWorkflow() {
  // Workflow state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('input');
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [brief, setBrief] = useState<BriefData>({
    client: '',
    project: '',
    objective: 'product_launch',
    targetMedia: [],
    targetAudience: '',
    tone: 'professional',
  });
  const [facts, setFacts] = useState<FactsData>({
    rawContent: '',
  });
  const [outputConfig, setOutputConfig] = useState<OutputConfig>({
    wordCountRange: '800-1200',
    languages: ['zh'], // 默认中文
  });
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<PRDraft | null>(null); // 保留用于单语言兼容
  const [drafts, setDrafts] = useState<PRDraft[]>([]); // 新增：多语言稿件数组
  const [primaryLanguage, setPrimaryLanguage] = useState<string>('zh'); // 新增：主语言
  const [fullText, setFullText] = useState<string>('');

  // Start workflow
  const handleStartWorkflow = useCallback(async () => {
    console.log('[pr-creator:frontend] Starting workflow...');
    setCurrentStep('analyzing');
    setError(null);

    try {
      const requestBody = {
        brief,
        facts: {
          rawContent: facts.rawContent.trim(),
        },
        outputConfig,
        additionalNotes,
      };
      console.log('[pr-creator:frontend] Request body:', requestBody);

      const startTime = Date.now();
      console.log('[pr-creator:frontend] Calling /api/workflow/pr-creator/start...');

      const response = await fetch('/api/workflow/pr-creator/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log(`[pr-creator:frontend] Response received in ${Date.now() - startTime}ms`);
      console.log('[pr-creator:frontend] Response status:', response.status);

      const result = await response.json();
      console.log('[pr-creator:frontend] Response data:', result);

      if (!response.ok) {
        throw new Error(result.error || '启动工作流失败');
      }

      setRunId(result.runId);

      // 注意：API 返回 suspendPayload，不是 suspendedData
      if (result.status === 'suspended' && result.suspendPayload) {
        console.log('[pr-creator:frontend] Workflow suspended, parsing suspendPayload...');
        // Workflow suspended for clarification
        setAnalysis({
          strengths: result.suspendPayload.analysis?.strengths || [],
          gaps: result.suspendPayload.analysis?.gaps || [],
          suggestedAngle: result.suspendPayload.analysis?.suggestedAngle || '',
          questions: result.suspendPayload.questions || [],
          canProceedWithoutClarification: result.suspendPayload.canSkip || false,
        });
        setCurrentStep('clarify');
      } else if (result.status === 'success') {
        console.log('[pr-creator:frontend] Workflow succeeded directly');
        // Direct to draft (no clarification needed)
        setDraft(result.result?.draft);
        setFullText(result.result?.fullText || '');
        setCurrentStep('review');
      } else {
        console.log('[pr-creator:frontend] Unexpected status:', result.status);
      }
    } catch (err) {
      console.error('[pr-creator:frontend] Error:', err);
      setError(err instanceof Error ? err.message : '发生未知错误');
      setCurrentStep('input');
    }
  }, [brief, facts, additionalNotes]);

  // Resume workflow with answers
  const handleSubmitAnswers = useCallback(async () => {
    if (!runId) return;

    setCurrentStep('generating');
    setError(null);

    try {
      const response = await fetch('/api/workflow/pr-creator/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          step: 'clarify-questions',
          resumeData: { answers, skipClarification: false },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '继续工作流失败');
      }

      if (result.status === 'suspended' && result.suspendedStep === 'human-review') {
        // Workflow suspended for review
        console.log('[pr-creator:frontend] Suspended at human-review');
        console.log('[pr-creator:frontend] suspendPayload:', result.suspendPayload);

        // 注意：后端返回的是 drafts 数组
        const allDrafts = result.suspendPayload?.drafts;
        const primary = result.suspendPayload?.primaryLanguage || 'zh';

        if (allDrafts && allDrafts.length > 0) {
          setDrafts(allDrafts);
          setPrimaryLanguage(primary);
          setDraft(allDrafts[0]); // 兼容性：仍然设置第一个
          console.log('[pr-creator:frontend] Set', allDrafts.length, 'drafts, primary:', primary);
        } else {
          console.error('[pr-creator:frontend] No drafts in suspendPayload!');
        }
        setCurrentStep('review');
      } else if (result.status === 'success') {
        console.log('[pr-creator:frontend] Workflow completed successfully');
        console.log('[pr-creator:frontend] result:', result.result);

        // 注意：后端返回的是 drafts 数组和 fullTexts 对象
        const drafts = result.result?.drafts;
        const fullTexts = result.result?.fullTexts;
        const primaryLanguage = result.result?.primaryLanguage || 'zh';

        if (drafts && drafts.length > 0) {
          setDraft(drafts[0]); // 显示主语言版本
          // 获取主语言的完整文本
          if (fullTexts && fullTexts[primaryLanguage]) {
            setFullText(fullTexts[primaryLanguage]);
          }
        }
        setCurrentStep('done');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生未知错误');
      setCurrentStep('clarify');
    }
  }, [runId, answers]);

  // Skip clarification
  const handleSkipClarification = useCallback(async () => {
    if (!runId) return;

    setCurrentStep('generating');
    setError(null);

    try {
      const response = await fetch('/api/workflow/pr-creator/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          step: 'clarify-questions',
          resumeData: { answers: {}, skipClarification: true },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '继续工作流失败');
      }

      if (result.status === 'suspended' && result.suspendedStep === 'human-review') {
        console.log('[pr-creator:frontend] (skip) Suspended at human-review');
        console.log('[pr-creator:frontend] (skip) suspendPayload:', result.suspendPayload);

        // 注意：后端返回的是 drafts 数组
        const allDrafts = result.suspendPayload?.drafts;
        const primary = result.suspendPayload?.primaryLanguage || 'zh';

        if (allDrafts && allDrafts.length > 0) {
          setDrafts(allDrafts);
          setPrimaryLanguage(primary);
          setDraft(allDrafts[0]);
        }
        setCurrentStep('review');
      } else if (result.status === 'success') {
        console.log('[pr-creator:frontend] Workflow completed successfully');
        console.log('[pr-creator:frontend] result:', result.result);

        // 注意：后端返回的是 drafts 数组和 fullTexts 对象
        const drafts = result.result?.drafts;
        const fullTexts = result.result?.fullTexts;
        const primaryLanguage = result.result?.primaryLanguage || 'zh';

        if (drafts && drafts.length > 0) {
          setDraft(drafts[0]); // 显示主语言版本
          // 获取主语言的完整文本
          if (fullTexts && fullTexts[primaryLanguage]) {
            setFullText(fullTexts[primaryLanguage]);
          }
        }
        setCurrentStep('done');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生未知错误');
      setCurrentStep('clarify');
    }
  }, [runId]);

  // Approve draft
  const handleApproveDraft = useCallback(async () => {
    if (!runId) return;

    setError(null);

    try {
      const response = await fetch('/api/workflow/pr-creator/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          step: 'human-review',
          resumeData: { approved: true },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '审批失败');
      }

      console.log('[pr-creator:frontend] Approved, workflow complete');
      console.log('[pr-creator:frontend] result:', result.result);

      // 处理多语言结果
      const fullTexts = result.result?.fullTexts;
      const primaryLanguage = result.result?.primaryLanguage || 'zh';
      if (fullTexts && fullTexts[primaryLanguage]) {
        setFullText(fullTexts[primaryLanguage]);
      } else if (result.result?.fullText) {
        // Fallback for single-language version
        setFullText(result.result.fullText);
      }

      setCurrentStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生未知错误');
    }
  }, [runId]);

  // Reject draft (currently just completes workflow with needs_revision status)
  const handleRejectDraft = useCallback(async (feedback: string) => {
    if (!runId) return;

    setError(null);

    try {
      const response = await fetch('/api/workflow/pr-creator/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          step: 'human-review',
          resumeData: { approved: false, feedback },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '操作失败');
      }

      console.log('[pr-creator:frontend] Rejected with feedback:', feedback);
      console.log('[pr-creator:frontend] result:', result);

      // Workflow should complete with needs_revision status
      if (result.status === 'done' || result.status === 'success') {
        setError('稿件已标记为需要修改。请返回首页重新开始。');
        setCurrentStep('done');
      } else {
        setError('操作完成，但工作流状态异常');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生未知错误');
    }
  }, [runId]);

  // Reset workflow
  const handleReset = useCallback(() => {
    setCurrentStep('input');
    setRunId(null);
    setError(null);
    setBrief({
      client: '',
      project: '',
      objective: 'product_launch',
      targetMedia: [],
      targetAudience: '',
      tone: 'professional',
    });
    setFacts({
      rawContent: '',
    });
    setAdditionalNotes('');
    setAnalysis(null);
    setAnswers({});
    setDraft(null);
    setFullText('');
  }, []);

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/agents/ai-workflow">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PR Creator</h1>
          <p className="text-sm text-muted-foreground">智能 PR 稿件创作工作流</p>
        </div>
      </div>

      {/* Progress indicator */}
      <StepIndicator currentStep={currentStep} />

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step content */}
      <div className="flex-1 overflow-auto">
        {currentStep === 'input' && (
          <InputStep
            brief={brief}
            setBrief={setBrief}
            facts={facts}
            setFacts={setFacts}
            outputConfig={outputConfig}
            setOutputConfig={setOutputConfig}
            additionalNotes={additionalNotes}
            setAdditionalNotes={setAdditionalNotes}
            onSubmit={handleStartWorkflow}
          />
        )}

        {currentStep === 'analyzing' && <LoadingStep message="AI 正在分析您的 Brief 和 Facts…" />}

        {currentStep === 'clarify' && analysis && (
          <ClarifyStep
            analysis={analysis}
            answers={answers}
            setAnswers={setAnswers}
            onSubmit={handleSubmitAnswers}
            onSkip={handleSkipClarification}
          />
        )}

        {currentStep === 'generating' && <LoadingStep message="AI 正在生成 PR 稿件…" />}

        {currentStep === 'review' && drafts.length > 0 && (
          <ReviewStep
            drafts={drafts}
            primaryLanguage={primaryLanguage}
            onApprove={handleApproveDraft}
            onReject={handleRejectDraft}
            onReset={handleReset}
          />
        )}

        {currentStep === 'done' && draft && (
          <DoneStep draft={draft} fullText={fullText} onReset={handleReset} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Step Components
// ============================================================================

function StepIndicator({ currentStep }: { currentStep: WorkflowStep }) {
  const steps = [
    { id: 'input', label: '输入素材', icon: FileText },
    { id: 'clarify', label: '澄清确认', icon: MessageSquare },
    { id: 'review', label: '审核稿件', icon: CheckCircle },
  ];

  const getStepStatus = (stepId: string) => {
    const order = ['input', 'analyzing', 'clarify', 'generating', 'review', 'done'];
    const currentIndex = order.indexOf(currentStep);

    if (currentStep === 'done') return 'completed';
    if (stepId === 'input' && currentIndex > 0) return 'completed';
    if (stepId === 'clarify' && (currentIndex >= order.indexOf('generating'))) return 'completed';
    // 'review' step 在 'done' 时完成，但 'done' 已在上面处理
    if (stepId === 'review' && currentIndex >= order.indexOf('done')) return 'completed';

    if (stepId === 'input' && currentIndex === 0) return 'current';
    if (stepId === 'clarify' && (currentStep === 'analyzing' || currentStep === 'clarify')) return 'current';
    if (stepId === 'review' && (currentStep === 'generating' || currentStep === 'review')) return 'current';

    return 'pending';
  };

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => {
        const status = getStepStatus(step.id);
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                status === 'current' && 'bg-primary text-primary-foreground',
                status === 'completed' && 'bg-green-100 text-green-700',
                status === 'pending' && 'bg-muted text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {step.label}
            </div>
            {index < steps.length - 1 && (
              <ArrowRight className="mx-2 h-4 w-4 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LoadingStep({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

// ============================================================================
// Input Step
// ============================================================================

interface InputStepProps {
  brief: BriefData;
  setBrief: React.Dispatch<React.SetStateAction<BriefData>>;
  facts: FactsData;
  setFacts: React.Dispatch<React.SetStateAction<FactsData>>;
  outputConfig: OutputConfig;
  setOutputConfig: React.Dispatch<React.SetStateAction<OutputConfig>>;
  additionalNotes: string;
  setAdditionalNotes: (value: string) => void;
  onSubmit: () => void;
}

function InputStep({
  brief,
  setBrief,
  facts,
  setFacts,
  outputConfig,
  setOutputConfig,
  additionalNotes,
  setAdditionalNotes,
  onSubmit,
}: InputStepProps) {
  const isValid =
    brief.client.trim() &&
    brief.project.trim() &&
    brief.targetAudience.trim() &&
    facts.rawContent.trim() &&
    outputConfig.languages.length > 0;

  // Debug logging
  console.log('[InputStep] Validation:', {
    hasClient: !!brief.client.trim(),
    hasProject: !!brief.project.trim(),
    hasAudience: !!brief.targetAudience.trim(),
    hasFacts: !!facts.rawContent.trim(),
    hasLanguages: outputConfig.languages.length > 0,
    languageCount: outputConfig.languages.length,
    isValid,
  });

  // 处理语言选择
  const toggleLanguage = (langCode: string) => {
    console.log('[toggleLanguage] Clicked:', langCode);
    console.log('[toggleLanguage] Current languages:', outputConfig.languages);

    setOutputConfig((prev) => {
      const isSelected = prev.languages.includes(langCode);
      console.log('[toggleLanguage] isSelected:', isSelected);

      if (isSelected) {
        // 取消选择
        const newLanguages = prev.languages.filter((l) => l !== langCode);
        console.log('[toggleLanguage] Deselecting, new languages:', newLanguages);
        return { ...prev, languages: newLanguages };
      } else {
        // 选择（最多3种）
        if (prev.languages.length >= 3) {
          console.log('[toggleLanguage] Already at limit (3)');
          return prev; // 已达上限
        }
        const newLanguages = [...prev.languages, langCode];
        console.log('[toggleLanguage] Selecting, new languages:', newLanguages);
        return { ...prev, languages: newLanguages };
      }
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Brief Section */}
      <Card>
        <CardHeader>
          <CardTitle>Brief 简报</CardTitle>
          <CardDescription>项目基本信息和目标</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client">客户/品牌名称 *</Label>
              <Input
                id="client"
                value={brief.client}
                onChange={(e) => setBrief({ ...brief, client: e.target.value })}
                placeholder="例如：TechCorp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project">项目名称 *</Label>
              <Input
                id="project"
                value={brief.project}
                onChange={(e) => setBrief({ ...brief, project: e.target.value })}
                placeholder="例如：新品发布会"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="objective">PR 目标</Label>
              <Select
                value={brief.objective}
                onValueChange={(value) => setBrief({ ...brief, objective: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product_launch">产品发布</SelectItem>
                  <SelectItem value="awareness">品牌曝光</SelectItem>
                  <SelectItem value="event">活动报道</SelectItem>
                  <SelectItem value="partnership">合作官宣</SelectItem>
                  <SelectItem value="funding">融资消息</SelectItem>
                  <SelectItem value="award">获奖荣誉</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone">语气风格</Label>
              <Select
                value={brief.tone}
                onValueChange={(value) => setBrief({ ...brief, tone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">专业严谨</SelectItem>
                  <SelectItem value="formal">正式官方</SelectItem>
                  <SelectItem value="casual">轻松亲切</SelectItem>
                  <SelectItem value="excited">热情激昂</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetAudience">目标受众 *</Label>
            <Input
              id="targetAudience"
              value={brief.targetAudience}
              onChange={(e) => setBrief({ ...brief, targetAudience: e.target.value })}
              placeholder="例如：科技爱好者、企业决策者、投资人"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetMedia">目标媒体（用逗号分隔）</Label>
            <Input
              id="targetMedia"
              value={brief.targetMedia.join(', ')}
              onChange={(e) =>
                setBrief({
                  ...brief,
                  targetMedia: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="例如：科技媒体, 财经媒体, 大众媒体"
            />
          </div>
        </CardContent>
      </Card>

      {/* Facts Section */}
      <Card>
        <CardHeader>
          <CardTitle>Facts 事实素材 *</CardTitle>
          <CardDescription>
            直接粘贴品牌方提供的文档内容，包括核心事实、引言、数据、背景信息等
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="rawContent"
            value={facts.rawContent}
            onChange={(e) => setFacts({ rawContent: e.target.value })}
            placeholder={`请粘贴品牌方提供的原始素材，例如：

【产品信息】
- 产品名称：XX 新品
- 发布时间：2024年X月X日
- 主要卖点：...

【核心数据】
- 销量/市场份额/增长率等

【高管引言】
"这是我们的重要里程碑..." —— CEO 张三

【背景信息】
公司简介、行业背景等...`}
            rows={12}
            className="min-h-[280px] font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Output Config Section */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>输出配置</CardTitle>
          <CardDescription>设置稿件的字数和语言（最多选择3种语言，将批量生成）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Word Count Range */}
          <div className="space-y-2">
            <Label>字数范围</Label>
            <Select
              value={outputConfig.wordCountRange}
              onValueChange={(value) => setOutputConfig({ ...outputConfig, wordCountRange: value })}
            >
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORD_COUNT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>输出语言（可多选，最多3种）</Label>
              <span className="text-sm text-muted-foreground">
                已选 {outputConfig.languages.length}/3
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = outputConfig.languages.includes(lang.code);
                const isDisabled = !isSelected && outputConfig.languages.length >= 3;
                return (
                  <Button
                    key={lang.code}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    disabled={isDisabled}
                    onClick={() => toggleLanguage(lang.code)}
                    className={`transition-all ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="mr-1.5">{lang.flag}</span>
                    {lang.name}
                  </Button>
                );
              })}
            </div>
            {outputConfig.languages.length === 0 && (
              <p className="text-sm text-destructive">请至少选择一种语言</p>
            )}
            {outputConfig.languages.length > 1 && (
              <p className="text-sm text-muted-foreground">
                将为每种语言生成独立的稿件版本
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Additional Notes */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>补充说明</CardTitle>
          <CardDescription>任何其他需要注意的事项</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="例如：需要突出环保理念、避免提及竞品名称..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="lg:col-span-2 flex justify-end">
        <Button
          size="lg"
          onClick={() => {
            console.log('[InputStep] Submit button clicked!');
            console.log('[InputStep] isValid:', isValid);
            console.log('[InputStep] outputConfig:', outputConfig);
            onSubmit();
          }}
          disabled={!isValid}
        >
          开始分析
          <Send className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Clarify Step
// ============================================================================

interface ClarifyStepProps {
  analysis: AnalysisResult;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSubmit: () => void;
  onSkip: () => void;
}

function ClarifyStep({ analysis, answers, setAnswers, onSubmit, onSkip }: ClarifyStepProps) {
  const allAnswered = analysis.questions.every((q) => answers[q.id]?.trim());

  return (
    <div className="space-y-6">
      {/* Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle>AI 分析结果</CardTitle>
          <CardDescription>基于您提供的 Brief 和 Facts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-green-700 mb-2">✓ 素材优势</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {analysis.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>

          {analysis.gaps.length > 0 && (
            <div>
              <h4 className="font-medium text-amber-700 mb-2">⚠ 信息缺口</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {analysis.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="font-medium mb-2">💡 建议角度</h4>
            <p className="text-sm text-muted-foreground">{analysis.suggestedAngle}</p>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      {analysis.questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>澄清问题</CardTitle>
            <CardDescription>请回答以下问题，帮助我们生成更好的稿件</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {analysis.questions.map((q, index) => (
              <div key={q.id} className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="font-medium">Q{index + 1}.</span>
                  <div className="flex-1">
                    <p className="font-medium">{q.question}</p>
                    <p className="text-sm text-muted-foreground mt-1">{q.context}</p>
                  </div>
                  <Badge
                    variant={
                      q.importance === 'high'
                        ? 'destructive'
                        : q.importance === 'medium'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {q.importance === 'high' ? '重要' : q.importance === 'medium' ? '建议' : '可选'}
                  </Badge>
                </div>
                <Textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  placeholder="请输入您的回答..."
                  rows={2}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-4">
        {analysis.canProceedWithoutClarification && (
          <Button variant="outline" onClick={onSkip}>
            跳过，直接生成
          </Button>
        )}
        <Button onClick={onSubmit} disabled={!allAnswered && !analysis.canProceedWithoutClarification}>
          提交回答，生成稿件
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Review Step - 支持多语言
// ============================================================================

interface ReviewStepProps {
  drafts: PRDraft[];  // 改为数组
  primaryLanguage: string;
  onApprove: () => void;
  onReject: (feedback: string) => void;
  onReset: () => void;
}

function ReviewStep({ drafts, primaryLanguage, onApprove, onReject, onReset }: ReviewStepProps) {
  const [selectedLanguage, setSelectedLanguage] = useState(primaryLanguage);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleRejectClick = () => {
    setShowFeedbackForm(true);
  };

  const handleSubmitFeedback = () => {
    if (!feedback.trim()) {
      return;
    }
    onReject(feedback);
  };

  const handleCancelFeedback = () => {
    setShowFeedbackForm(false);
    setFeedback('');
  };

  // 如果只有一个语言版本，直接显示，不需要 Tab
  if (drafts.length === 1) {
    return <SingleDraftReview draft={drafts[0]} onApprove={onApprove} onReject={onReject} onReset={onReset} />;
  }

  // 多语言版本，使用 Tab 切换
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>稿件预览</CardTitle>
          <CardDescription>
            已生成 {drafts.length} 个语言版本，请逐一审核
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${drafts.length}, 1fr)` }}>
              {drafts.map((draft) => {
                const langCode = draft.language || 'unknown';
                const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
                return (
                  <TabsTrigger key={langCode} value={langCode}>
                    <span className="mr-1.5">{langInfo?.flag || '🌐'}</span>
                    {langInfo?.name || langCode}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {drafts.map((draft) => {
              const langCode = draft.language || 'unknown';
              return (
                <TabsContent key={langCode} value={langCode}>
                  <DraftPreview draft={draft} />
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Feedback Form */}
      {showFeedbackForm && (
        <Card>
          <CardHeader>
            <CardTitle>修改意见</CardTitle>
            <CardDescription>请提供您希望修改的具体内容，AI 将基于您的反馈修改所有语言版本</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="例如：标题太长了，建议控制在20字以内；正文第二段需要补充更多数据支撑..."
              rows={6}
              className="resize-none"
            />
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={handleCancelFeedback}>
                取消
              </Button>
              <Button onClick={handleSubmitFeedback} disabled={!feedback.trim()}>
                提交反馈，重新生成
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!showFeedbackForm && (
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={onReset}>
            重新开始
          </Button>
          <Button variant="outline" onClick={handleRejectClick}>
            <AlertCircle className="mr-2 h-4 w-4" />
            不通过，提供修改意见
          </Button>
          <Button onClick={onApprove}>
            批准所有版本
            <Check className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 单稿件审核组件（原 ReviewStep 逻辑）
// ============================================================================

interface SingleDraftReviewProps {
  draft: PRDraft;
  onApprove: () => void;
  onReject: (feedback: string) => void;
  onReset: () => void;
}

function SingleDraftReview({ draft, onApprove, onReject, onReset }: SingleDraftReviewProps) {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleRejectClick = () => {
    setShowFeedbackForm(true);
  };

  const handleSubmitFeedback = () => {
    if (!feedback.trim()) {
      return;
    }
    onReject(feedback);
  };

  const handleCancelFeedback = () => {
    setShowFeedbackForm(false);
    setFeedback('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>稿件预览</CardTitle>
          <CardDescription>请审核 AI 生成的 PR 稿件</CardDescription>
        </CardHeader>
        <CardContent>
          <DraftPreview draft={draft} />
        </CardContent>
      </Card>

      {/* Feedback Form */}
      {showFeedbackForm && (
        <Card>
          <CardHeader>
            <CardTitle>修改意见</CardTitle>
            <CardDescription>请提供您希望修改的具体内容</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="例如：标题太长了，建议控制在20字以内；正文第二段需要补充更多数据支撑..."
              rows={6}
              className="resize-none"
            />
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={handleCancelFeedback}>
                取消
              </Button>
              <Button onClick={handleSubmitFeedback} disabled={!feedback.trim()}>
                提交反馈，重新生成
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!showFeedbackForm && (
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            重新开始
          </Button>
          <Button variant="outline" onClick={handleRejectClick}>
            <AlertCircle className="mr-2 h-4 w-4" />
            不通过，提供修改意见
          </Button>
          <Button onClick={onApprove}>
            <CheckCircle className="mr-2 h-4 w-4" />
            确认通过
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Draft Preview Component（稿件展示组件）
// ============================================================================

function DraftPreview({ draft }: { draft: PRDraft }) {
  // 统计正文字数
  const bodyLength = draft.body.length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold">{draft.title}</h2>
        {draft.subtitle && <p className="text-lg text-muted-foreground mt-1">{draft.subtitle}</p>}
      </div>

      <Separator />

      {/* Lead */}
      <div>
        <Badge variant="outline" className="mb-2">
          导语
        </Badge>
        <p className="text-lg leading-relaxed">{draft.lead}</p>
      </div>

      <Separator />

      {/* Body */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline">正文</Badge>
          <span className="text-sm text-muted-foreground">字数: {bodyLength}</span>
        </div>
        <div className="prose prose-sm max-w-none">
          {draft.body.split('\n\n').map((para, i) => (
            <p key={i} className="leading-relaxed">
              {para}
            </p>
          ))}
        </div>
      </div>

      <Separator />

      {/* Boilerplate */}
      <div>
        <Badge variant="outline" className="mb-2">
          关于
        </Badge>
        <p className="text-sm text-muted-foreground">{draft.boilerplate}</p>
      </div>

      <Separator />

      {/* Key Messages */}
      <div>
        <Badge variant="outline" className="mb-2">
          核心要点
        </Badge>
        <ul className="list-disc list-inside space-y-1">
          {draft.keyMessages.map((msg, i) => (
            <li key={i} className="text-sm">
              {msg}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// Done Step
// ============================================================================

interface DoneStepProps {
  draft: PRDraft;
  fullText: string;
  onReset: () => void;
}

function DoneStep({ draft, fullText, onReset }: DoneStepProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
  };

  const handleDownload = () => {
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${draft.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          PR 稿件已生成完成！您可以复制或下载稿件。
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{draft.title}</CardTitle>
              {draft.subtitle && (
                <CardDescription className="mt-1">{draft.subtitle}</CardDescription>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                复制
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                下载
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{fullText}</pre>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          创建新稿件
        </Button>
      </div>
    </div>
  );
}
