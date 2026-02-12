import { PostHogProvider as PHProvider } from '@posthog/react'
import { posthog } from '~/lib/observability/posthog.client'

/**
 * PostHog 产品分析 Provider
 * 在 __root.tsx 中包裹应用，使 usePostHog 等 hook 可用
 */
export function PostHogProviderWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <PHProvider client={posthog}>{children}</PHProvider>
}
