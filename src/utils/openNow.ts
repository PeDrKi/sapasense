export type OpenState = 'open' | 'closed' | 'always' | null

/** "07:30–16:30" → [7.5, 16.5]; "24/24" → 'always'; anything else → null. */
export function parseHours(hours?: string | null): [number, number] | 'always' | null {
  const h = (hours || '').trim()
  if (/^24\s*\/\s*24$/.test(h)) return 'always'
  const m = h.match(/^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return [+m[1] + +m[2] / 60, +m[3] + +m[4] / 60]
}

export function openState(hours: string | undefined | null, now: Date = new Date()): OpenState {
  const p = parseHours(hours)
  if (!p) return null
  if (p === 'always') return 'always'
  const t = now.getHours() + now.getMinutes() / 60
  return t >= p[0] && t < p[1] ? 'open' : 'closed'
}
