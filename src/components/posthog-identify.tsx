import { useEffect } from 'react'
import { usePostHog } from '@posthog/react'
import { useSession } from '~/hooks/auth-hooks'

/**
 * 在用户登录后调用 posthog.identify 关联用户
 * 渲染为 null，仅作为副作用组件
 */
export function PostHogIdentify() {
  const posthog = usePostHog()
  const { data: sessionData } = useSession()

  useEffect(() => {
    if (!posthog) return
    const user = sessionData?.user
    if (user?.id) {
      posthog.identify(user.id, {
        email: user.email ?? undefined,
        name: user.name ?? undefined,
      })
    }
  }, [posthog, sessionData?.user?.id, sessionData?.user?.email, sessionData?.user?.name])

  return null
}
