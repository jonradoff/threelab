/**
 * Build a shareable URL from a short share code.
 */
export function buildShareUrl(code: string): string {
  const base = window.location.origin
  return `${base}/s/${code}`
}

/**
 * Extract a share code from the current URL path if present.
 * Matches /s/{code} pattern.
 */
export function getShareCodeFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/s\/([a-z0-9]+)$/i)
  return match ? match[1] : null
}
