import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { usePostHog } from '@posthog/react'

/**
 * TanStack Start + PostHog: 使用 RouterEvents 捕获 pageview
 *
 * 社区实践：beforeLoad 有时序问题（URL 可能未更新），
 * 推荐在 router.subscribe('onResolved') 时捕获，确保 URL 正确。
 *
 * 需在 posthog.client.ts 中设置 capture_pageview: false 以避免重复上报。
 */
export function PostHogPageviewTracker() {
  const router = useRouter()
  const posthog = usePostHog()

  useEffect(() => {
    if (!posthog) return
    // 初始页面：组件挂载时捕获当前 URL（因为 subscribe 只会在后续路由变化时触发）
    posthog.capture('$pageview', {
      $current_url: typeof window !== 'undefined' ? window.location.href : '',
    })
    const unsub = router.subscribe('onResolved', (evt) => {
      if (evt.pathChanged || evt.hrefChanged) {
        posthog.capture('$pageview', {
          $current_url: evt.toLocation.href ?? window.location.href,
        })
      }
    })
    return () => unsub()
  }, [router, posthog])

  return null
}
