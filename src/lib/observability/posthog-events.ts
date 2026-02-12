/**
 * PostHog 业务事件追踪
 * 集中封装，便于维护、采样、脱敏
 */
import { posthog } from './posthog.client'

export function trackClaudeAgentQuerySent(props: {
  queryLength: number
  hasAttachments: boolean
  attachmentCount: number
  skillSlug?: string | null
  skillName?: string | null
  sessionId?: string
  isNewSession?: boolean
}) {
  posthog?.capture('claude_agent_query_sent', {
    query_length: props.queryLength,
    has_attachments: props.hasAttachments,
    attachment_count: props.attachmentCount,
    ...(props.skillSlug && { skill_slug: props.skillSlug }),
    ...(props.skillName && { skill_name: props.skillName }),
    ...(props.sessionId && { session_id: props.sessionId.slice(0, 8) }), // 脱敏
    ...(props.isNewSession !== undefined && { is_new_session: props.isNewSession }),
  })
}

export function trackClaudeChatViewChanged(props: {
  view: string
  previousView?: string
  sessionId?: string
}) {
  posthog?.capture('claude_chat_view_changed', {
    view: props.view,
    ...(props.previousView && { previous_view: props.previousView }),
    ...(props.sessionId && { session_id: props.sessionId.slice(0, 8) }),
  })
}

export function trackClaudeAgentSessionCreated(props: { sessionId?: string }) {
  posthog?.capture('claude_agent_session_created', {
    ...(props.sessionId && { session_id: props.sessionId.slice(0, 8) }),
  })
}

export function trackClaudeAgentSessionSwitched(props: {
  sessionId?: string
  isResume?: boolean
}) {
  posthog?.capture('claude_agent_session_switched', {
    ...(props.sessionId && { session_id: props.sessionId.slice(0, 8) }),
    ...(props.isResume !== undefined && { is_resume: props.isResume }),
  })
}

export function trackSkillEnabled(props: {
  skillSlug: string
  skillName?: string
  source?: 'official' | 'user' | 'github'
}) {
  posthog?.capture('skill_enabled', {
    skill_slug: props.skillSlug,
    ...(props.skillName && { skill_name: props.skillName }),
    ...(props.source && { source: props.source }),
  })
}

export function trackSkillDisabled(props: {
  skillSlug: string
  skillName?: string
  source?: 'official' | 'user' | 'github'
}) {
  posthog?.capture('skill_disabled', {
    skill_slug: props.skillSlug,
    ...(props.skillName && { skill_name: props.skillName }),
    ...(props.source && { source: props.source }),
  })
}

/**
 * Session 汇总事件：用户离开 session 时上报累积的 token/轮次/成本
 * 触发时机：切换 session、离开页面、关闭标签
 */
export function trackClaudeAgentSessionSummary(props: {
  sessionId: string
  inputTokens?: number
  outputTokens?: number
  numTurns?: number
  durationMs?: number
  totalCostUsd?: number
}) {
  posthog?.capture('claude_agent_session_summary', {
    session_id: props.sessionId.slice(0, 8),
    ...(props.inputTokens !== undefined && { input_tokens: props.inputTokens }),
    ...(props.outputTokens !== undefined && { output_tokens: props.outputTokens }),
    ...(props.numTurns !== undefined && { num_turns: props.numTurns }),
    ...(props.durationMs !== undefined && { duration_ms: props.durationMs }),
    ...(props.totalCostUsd !== undefined && { total_cost_usd: props.totalCostUsd }),
  })
}
