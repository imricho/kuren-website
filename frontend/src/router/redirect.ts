/** Control characters, whitespace and backslashes (browsers treat `\` like `/`). */
const UNSAFE = /[\x00-\x20\\]/

/**
 * Only allow in-app redirects (prevents open redirects via ?redirect= / ?from=).
 * Returns the normalised pathname + search + hash, or `fallback`.
 */
export function safeRedirect(value: unknown, fallback = '/dashboard'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || UNSAFE.test(value)) return fallback
  const origin = typeof location !== 'undefined' && location.origin && location.origin !== 'null' ? location.origin : 'http://localhost'
  try {
    const url = new URL(value, origin)
    if (url.origin !== origin) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
