import { Link, createFileRoute } from '@tanstack/react-router';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import {
  MessageSquare,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Code2,
  Database,
  Palette,
  Cpu,
  Zap,
  Box,
  GitBranch,
  BarChart3,
} from 'lucide-react';
import GradientOrb from '~/components/gradient-orb';

export const Route = createFileRoute('/(marketing)/')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Hero Section */}
      <section className="container relative z-0 mx-auto flex flex-col items-center px-4 pt-20 pb-16 text-center md:pt-32 md:pb-24">
        <GradientOrb className="-translate-x-1/2 absolute top-0 left-1/2 z-[-1] transform" />

        <Badge variant="secondary" className="mb-4 px-4 py-1">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Claude Agent SDK + Zhipu AI GLM-4.7
        </Badge>

        <h1 className="max-w-4xl font-bold text-4xl text-foreground md:text-6xl lg:text-7xl">
          Claude Desktop-Style Agent Chat
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
          A full-featured AI agent interface powered by Zhipu AI GLM-4.7. Features Skills Store,
          Artifacts, Knowledge Base, and Session Management via WebSocket.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Button size="lg" asChild className="rounded-full px-8">
            <Link to="/agents/claude-chat">
              Try DeeptoAI <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="rounded-full px-8" asChild>
            <a
              href="https://github.com/foreveryh/constructa-starter"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          </Button>
        </div>

        <p className="mt-8 text-muted-foreground text-sm">
          Powered by{' '}
          <a
            href="https://open.bigmodel.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Zhipu AI GLM-4.7
          </a>
        </p>
      </section>

      {/* Core Features Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Full-Featured Claude Agent Experience
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need from Claude Desktop, plus Skills Store and more
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {/* DeeptoAI Agent Chat */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <MessageSquare className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>DeeptoAI Agent Chat</CardTitle>
              <CardDescription>
                Full Claude Desktop replica with Claude Agent SDK integration
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Skills Store */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <Box className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>Skills Store</CardTitle>
              <CardDescription>
                Enable/disable custom skills to extend agent capabilities dynamically
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Artifacts */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <GitBranch className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>Artifacts System</CardTitle>
              <CardDescription>
                Support for HTML, Markdown, React, and SVG artifacts with live preview
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Knowledge Base */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <Database className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>Knowledge Base</CardTitle>
              <CardDescription>
                Upload and manage documents for context-aware conversations
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Session Management */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <GitBranch className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>Session Management</CardTitle>
              <CardDescription>
                Create, resume, and switch between multiple chat sessions with full history
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Tool Visualization */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <Cpu className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>Tool Visualization</CardTitle>
              <CardDescription>
                See tool calls, arguments, and results in real-time with detailed feedback
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Production-Ready Tech Stack
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Built on proven technologies for reliability and scalability
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-primary" />
                Claude Chat (Main Feature)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Claude Agent SDK
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Zhipu AI GLM-4.7
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  WebSocket (real-time)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Assistant UI components
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Additional Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Mastra AI Chat (SSE-based)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Better Auth (OAuth + password)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  PostgreSQL + Drizzle ORM
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  shadcn/ui + Tailwind CSS v4
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Two Independent Chat Systems
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Built for different use cases with optimal architectures
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <Badge className="mb-2 w-fit">Main Feature</Badge>
              <CardTitle className="text-xl">DeeptoAI Agent Chat</CardTitle>
              <CardDescription className="text-base">
                Full-featured agent with WebSocket-based real-time communication
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Skills Store for dynamic capabilities</li>
                <li>• Artifacts panel with multiple formats</li>
                <li>• Session management and history</li>
                <li>• Tool call visualization</li>
                <li>• Knowledge Base integration</li>
                <li>• Usage statistics tracking</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Badge variant="secondary" className="mb-2 w-fit">Secondary</Badge>
              <CardTitle className="text-xl">Mastra AI Chat</CardTitle>
              <CardDescription className="text-base">
                Simple chat interface using Mastra + SSE streaming
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Mastra Agent Framework</li>
                <li>• Zhipu AI GLM-4.7 model</li>
                <li>• Vercel AI SDK integration</li>
                <li>• SSE-based streaming</li>
                <li>• Modern AI Elements UI</li>
                <li>• File reading capability</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <Card className="mx-auto max-w-2xl border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col items-center p-8 text-center md:p-12">
            <MessageSquare className="mb-4 h-12 w-12 text-primary" />
            <h2 className="mb-4 text-2xl font-bold md:text-3xl">
              Ready to Try DeeptoAI?
            </h2>
            <p className="mb-8 text-muted-foreground">
              Start chatting with the AI agent powered by Claude Agent SDK and Skills Store
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button size="lg" className="rounded-full px-8" asChild>
                <Link to="/agents/claude-chat">
                  Start Claude Chat <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8" asChild>
                <Link to="/agents/skills">
                  <Box className="mr-2 h-4 w-4" />
                  Browse Skills
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="container mx-auto border-t px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-center text-sm text-muted-foreground">
            © 2024 Constructa Starter. MIT License.
          </p>
          <p className="text-center text-sm text-muted-foreground">
            <a
              href="https://github.com/foreveryh/constructa-starter"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              GitHub
            </a>
            {' '}&bull;{' '}
            <a
              href="https://github.com/anthropics/claude-agent-kit"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Claude Agent SDK
            </a>
            {' '}&bull;{' '}
            <a
              href="https://open.bigmodel.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Zhipu AI
            </a>
            {' '}&bull;{' '}
            <a
              href="https://assistant-ui.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Assistant UI
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
