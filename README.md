# OxyGenie

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

OxyGenie is an **extensible, enterprise-ready AI agent platform for small and medium teams**. It replaces generic GPT products (ChatGPT, 豆包, DeepSeek) with advanced capabilities like Skills Store, MCP integration, Artifacts generation, and Python code execution - all deployable on-premises with support for cost-effective models like GLM 4.7.

Built with Claude Agent SDK and TanStack Start, OxyGenie provides a web-first alternative to desktop AI tools, featuring one-click Skills and MCP integration, real-time streaming, session persistence, and a beautiful, fluid UI.

**Key Differentiators**:
- 🎯 **Enterprise-Ready**: On-premises deployment, data security, team collaboration
- 🔌 **One-Click Skills & MCP**: Extend capabilities instantly, no complex setup
- 🎨 **Artifacts System**: Generate web pages, documents, and visualizations
- 🐍 **Python Code Execution**: Full sandboxed code execution environment
- 💰 **Cost-Effective Models**: Support for GLM 4.7 and other affordable models
- 🚀 **Production-Ready**: Built with modern full-stack principles, SSR, type-safe routing

## Features

### Core Capabilities

- **🎯 Skills Store & MCP Integration**: One-click enable/disable of custom skills and MCP servers to extend agent capabilities dynamically - inspired by craft-agents desktop
- **🎨 Artifacts System**: Generate and preview web pages, documents (HTML, Markdown, React, SVG) with live editing capabilities
- **🐍 Python Code Execution**: Full sandboxed Python execution environment for code generation, data analysis, and automation
- **🏢 On-Premises Deployment**: Deploy in your own infrastructure for data security and compliance
- **💰 Multi-Model Support**: Support for cost-effective models like GLM 4.7, in addition to Claude and other providers

### Enterprise Features

- **👥 Team Collaboration**: Multi-user support with session management, knowledge base sharing
- **📚 Knowledge Base**: Upload and manage documents for context-aware conversations
- **💾 Session Management**: Create, resume, and switch between multiple chat sessions with full persistence
- **🔐 Authentication**: Better Auth with email/password, OAuth (GitHub, Google)
- **📊 Usage Tracking**: Monitor token usage and costs per user/session

### Technical Features

- **⚡ Real-time Streaming**: WebSocket-based bidirectional communication for complex state management
- **🔧 Tool Visualization**: See tool calls, arguments, and results in real-time
- **🎨 Beautiful UI**: Built with shadcn/ui components, Tailwind CSS v4, dark mode
- **🔄 Mastra AI Chat**: Alternative chat interface using Mastra Agent Framework + SSE

## Installation

### Build from Source

```bash
git clone https://github.com/Deeptoai-com/OxyGenie.git
cd OxyGenie
pnpm install
```

## Quick Start

1. **Clone and install:**
   ```bash
   git clone https://github.com/Deeptoai-com/OxyGenie.git
   cd OxyGenie
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   **Minimum required environment variables:**
   ```bash
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/oxygenie"
   
   # Claude Agent SDK (required for main chat feature)
   ANTHROPIC_API_KEY="sk-ant-..."
   
   # Better Auth (required for authentication)
   BETTER_AUTH_SECRET="your-secret-key-here"
   BETTER_AUTH_URL="http://localhost:3000"
   ```
   
   See [.env.example](.env.example) for all available configuration options.

3. **Set up the database:**
   ```bash
   pnpm db:migrate
   ```

4. **Start the application:**
   ```bash
   # Terminal 1: Start the main app
   pnpm dev
   
   # Terminal 2: Start the WebSocket server (required for Claude Chat)
   node ws-server.mjs
   ```

5. **Open the app:**
   Navigate to `http://localhost:3000/agents/claude-chat` for the main Claude Agent Chat interface.

## Why OxyGenie?

### vs. Generic GPT Products (ChatGPT, 豆包, DeepSeek)

| Feature | Generic GPT Products | OxyGenie |
|---------|---------------------|----------|
| **Deployment** | Cloud-only, SaaS | ✅ On-premises, self-hosted |
| **Data Security** | Data sent to third-party | ✅ Your data stays in your infrastructure |
| **Skills & MCP** | Limited or none | ✅ One-click Skills Store & MCP integration |
| **Artifacts** | Basic text output | ✅ Rich Artifacts: web pages, documents, visualizations |
| **Code Execution** | Limited or none | ✅ Full Python sandbox execution |
| **Model Choice** | Fixed models | ✅ Support for GLM 4.7 and other cost-effective models |
| **Team Features** | Limited collaboration | ✅ Multi-user, knowledge base, session sharing |
| **Customization** | Fixed features | ✅ Extensible with Skills and MCP |

### vs. Desktop AI Tools (Claude Desktop, craft-agents)

| Feature | Desktop Tools | OxyGenie |
|---------|--------------|----------|
| **Platform** | Desktop app | ✅ Web app, cross-platform |
| **Deployment** | Local installation | ✅ Server deployment, team access |
| **Access** | Single device | ✅ Any device with browser |
| **Skills & MCP** | ✅ Supported | ✅ Supported (one-click) |
| **Artifacts** | ✅ Supported | ✅ Supported (web-optimized) |

## Web App Features

### Skills Store & MCP Integration

- **One-Click Enable**: Enable/disable skills and MCP servers instantly through the UI
- **Dynamic Loading**: Skills are dynamically loaded into agent sessions without restart
- **Skill Discovery**: Browse and discover available skills from the store
- **MCP Support**: Full Model Context Protocol integration for extended capabilities
- **User-Level Control**: Enable/disable skills per user or team

### Artifacts System

- **Web Page Generation**: Generate complete HTML pages with live preview
- **Document Creation**: Create Markdown, HTML, and formatted documents
- **Visualizations**: Generate React components, SVG graphics, and charts
- **Live Preview**: Real-time preview and editing of generated artifacts
- **Artifact Panel**: Dedicated panel for viewing and managing all artifacts

### Python Code Execution

- **Sandboxed Environment**: Secure, isolated Python execution per session
- **Full Python Support**: Access to standard library and common packages
- **Real-time Output**: See code execution results in real-time
- **Error Handling**: Clear error messages and debugging support
- **Session Persistence**: Code execution state persists across sessions

### Session Management

- **Session List**: View and manage all your chat sessions
- **Session Resume**: Continue previous conversations seamlessly
- **Session Switching**: Switch between multiple active sessions
- **Session Naming**: AI-generated titles or manual naming
- **Session Persistence**: Full conversation history saved to database

### Knowledge Base

- **Document Upload**: Upload documents (PDF, Markdown, text files) to your knowledge base
- **Context-Aware**: Documents are automatically included in conversation context
- **Document Management**: Organize and manage your knowledge base documents
- **Team Sharing**: Share knowledge base documents across team members

### Real-time Communication

- **WebSocket Streaming**: Real-time bidirectional communication for complex state management
- **Tool Visualization**: See tool calls, arguments, and results in real-time
- **Usage Statistics**: Track token usage and cost information per user/session

## Architecture

This project features **two independent chat systems**:

### 1. Claude Chat (Main Feature) `/agents/claude-chat`

**Backend**:
- WebSocket Server (`ws-server.mjs`) - Real-time bidirectional communication
- Claude Agent SDK integration for full agent capabilities
- Worker process isolation for user sandboxing

**Frontend**:
- Assistant UI components with Claude-style design
- Skills Store for dynamic capability extension
- Artifacts Panel (HTML, Markdown, React, SVG)
- Session List with resume/create/switch
- Knowledge Base Panel for document context
- Usage Card for statistics

**Features**:
- WebSocket-based real-time streaming
- Skills management (enable/disable per user)
- Artifact detection and rendering
- Session persistence and history
- Tool call visualization

### 2. Mastra AI Chat (Secondary) `/agents/ai-chat`

**Backend**:
- Uses `handleChatStream` from `@mastra/ai-sdk`
- Returns SSE stream via `createUIMessageStreamResponse`
- Agent: `assistant-agent` with file reading capability

**Frontend**:
- Uses `useChat` hook from `@ai-sdk/react`
- AI Elements: PromptInput, Actions, Suggestions, Sources, Reasoning

**Features**:
- SSE-based streaming
- Simple chat interface
- File reading from S3/MinIO

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js 22.12+ |
| **AI (Primary)** | [@anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) - Claude models |
| **AI (Alternative)** | [Mastra](https://mastra.ai) - GLM 4.7, GLM 4.6, and other cost-effective models |
| **Framework** | [TanStack Start](https://tanstack.com/start) - Full-stack React framework |
| **Routing** | [TanStack Router](https://tanstack.com/router) - Type-safe file-based routing |
| **UI** | [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS v4 |
| **Real-time** | [WebSocket](https://github.com/websockets/ws) |
| **Database** | PostgreSQL + [Drizzle ORM](https://orm.drizzle.team/) |
| **Auth** | [Better Auth](https://better-auth.com/) |
| **State** | [Zustand](https://zustand-demo.pmnd.rs) |
| **Build** | Vite + Nitro |

## Configuration

### Environment Variables

**Required:**
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/oxygenie"
ANTHROPIC_API_KEY="sk-ant-..."
BETTER_AUTH_SECRET="your-secret-key-here"
BETTER_AUTH_URL="http://localhost:3000"
```

**Optional:**
```bash
# WebSocket URL (for production with reverse proxy)
VITE_WS_URL="wss://your-domain.com/ws/agent"

# Multi-Model Support (Cost-Effective Models)
# GLM 4.7 and other models via Mastra
ZHIPU_API_KEY="your-zhipu-api-key"  # For GLM 4.7, GLM 4.6, GLM 4.5

# OAuth Providers
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

See [.env.example](.env.example) for complete configuration options.

### Multi-Model Support

OxyGenie supports multiple AI models for cost optimization:

**Claude Models** (via Claude Agent SDK):
- Claude 3.5 Sonnet
- Claude 3 Opus
- Claude 3 Haiku

**GLM Models** (via Mastra, cost-effective):
- GLM 4.7 (205K context)
- GLM 4.6 (205K context)
- GLM 4.5 (131K context)
- GLM 4 Air/Flash (lightweight versions)

**Configuration**:
- Claude models: Set `ANTHROPIC_API_KEY` in `.env`
- GLM models: Set `ZHIPU_API_KEY` in `.env`, use `zhipuai/glm-4.7` in Mastra agents

### On-Premises Deployment

OxyGenie is designed for on-premises deployment, giving you full control over your data:

**Benefits**:
- ✅ **Data Security**: All data stays in your infrastructure
- ✅ **Compliance**: Meet enterprise security and privacy requirements
- ✅ **Cost Control**: Use cost-effective models like GLM 4.7
- ✅ **Customization**: Full control over Skills, MCP servers, and configurations

**Deployment Options**:
- Docker Compose (recommended for small teams)
- Kubernetes (for larger deployments)
- Traditional server deployment

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed deployment instructions.

## Development

```bash
# Start development server
pnpm dev

# Start WebSocket server (required for Claude Chat)
node ws-server.mjs

# Run database migrations
pnpm db:migrate

# Quality checks (run before committing)
pnpm typecheck    # TypeScript type checking
pnpm lint         # Code linting
pnpm validate-routes  # TanStack Start route validation
pnpm test         # Run tests
```

For detailed development guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

## CI/CD

This project uses GitHub Actions for continuous integration. The CI pipeline runs on every push and pull request, checking:

- ✅ **Type checking** (`pnpm typecheck`)
- ✅ **Linting** (`pnpm lint`)
- ✅ **Route validation** (`pnpm validate-routes`)
- ✅ **Tests** (`pnpm test`)

See [.github/workflows/ci.yml](.github/workflows/ci.yml) for the complete CI configuration.

## Routes

| Route | Description | Type |
|-------|-------------|------|
| `/agents/claude-chat` | **Main** - Claude Agent Chat with full features | WebSocket |
| `/agents/ai-chat` | Secondary - Mastra-powered simple chat | SSE |
| `/agents/skills` | Skills Store management page | - |
| `/api/chat` | Mastra chat API endpoint | POST, SSE |
| `/api/skills/*` | Skills API endpoints | REST |

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

This project uses the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk), which is subject to [Anthropic's Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms).

Other key dependencies:
- **Better Auth** - Authentication library
- **Mastra** - AI Agent Framework
- **TanStack Start** - Full-stack React framework
- **Drizzle ORM** - PostgreSQL ORM

See [NOTICE](NOTICE) for complete third-party license information.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

To report security vulnerabilities, please see [SECURITY.md](SECURITY.md).

## Links

- **GitHub**: https://github.com/Deeptoai-com/OxyGenie
- **Claude Agent SDK**: https://github.com/anthropics/claude-agent-sdk
- **Mastra Docs**: https://mastra.ai
- **Assistant UI**: https://assistant-ui.com
- **TanStack Start**: https://tanstack.com/start
