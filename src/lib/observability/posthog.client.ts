import posthog from 'posthog-js'

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const host = import.meta.env.VITE_POSTHOG_HOST as string | undefined

if (typeof window !== 'undefined' && key) {
  posthog.init(key, {
    api_host: host || 'https://eu.i.posthog.com',
    defaults: '2026-01-30',
    person_profiles: 'identified_only',
    // 使用 PostHogPageviewTracker (RouterEvents) 手动捕获，避免 History API 自动捕获导致重复
    capture_pageview: false,
  })
} else if (import.meta.env.DEV && !key) {
  console.warn('[posthog] VITE_POSTHOG_KEY missing; product analytics disabled')
}

export { posthog }
