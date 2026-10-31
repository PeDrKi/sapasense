// Share a plan as a URL hash: answers + ordered stop ids + start hour/date. No server needed.
import { isValidBudget } from './budget'
import { ALLERGENS } from '../data/health'
import type { Answers, Plan, Focus } from '../types'

const KEYS: (keyof Answers)[] = ['mood', 'budget', 'people', 'time', 'group', 'mode', 'focus', 'startHour', 'dayOffset', 'fitness', 'allergies', 'motionSick']
const MOODS = ['calm', 'adventure', 'nostalgia', 'energy']
const TIMES = ['2h', 'half', 'full']
const GROUPS = ['solo', 'couple', 'friends', 'family', 'any']

function b64(s: string): string { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
function unb64(s: string): string { return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))) }

export function encodePlan({ answers, result }: { answers: Answers; result: Plan }): string {
  const a: Record<string, unknown> = {}
  KEYS.forEach(k => { if (answers[k] !== undefined && answers[k] !== null) a[k] = answers[k] })
  const payload = { a, ids: result.stops.map(s => s.id), sh: result.startHour, d: result.dateISO }
  return b64(JSON.stringify(payload))
}

export function decodePlan(hash: unknown): { answers: Answers; ids: string[]; startHour?: number; dateISO?: string } | null {
  try {
    const raw = String(hash || '').replace(/^#?p=/, '')
    if (!raw) return null
    const { a, ids, sh, d } = JSON.parse(unb64(raw))
    if (!a || !MOODS.includes(a.mood) || !TIMES.includes(a.time) || !GROUPS.includes(a.group)) return null
    if (!isValidBudget(a.budget)) return null
    if (!Array.isArray(ids) || ids.some((i: unknown) => typeof i !== 'string')) return null
    const answers: Answers = { mood:a.mood, budget:a.budget, time:a.time, group:a.group, mode:a.mode === 'local' ? 'local' : 'tourist', focus:(['food', 'cafe'].includes(a.focus) ? a.focus : 'all') as Focus }
    if (Number.isInteger(a.people) && a.people >= 1 && a.people <= 100) answers.people = a.people
    if (a.fitness === 'limited') answers.fitness = 'limited'
    if (a.motionSick === true) answers.motionSick = true
    if (Array.isArray(a.allergies)) { const al = a.allergies.filter((x: unknown) => typeof x === 'string' && x in ALLERGENS); if (al.length) answers.allergies = al }
    if (Number.isFinite(a.startHour)) answers.startHour = a.startHour
    if (Number.isInteger(a.dayOffset) && a.dayOffset >= 0 && a.dayOffset <= 1) answers.dayOffset = a.dayOffset
    return {
      answers, ids: ids.slice(0, 12),
      startHour: Number.isFinite(sh) ? sh : undefined,
      dateISO: /^\d{4}-\d\d-\d\d$/.test(d || '') ? d : undefined,
    }
  } catch { return null }
}

/** Google Maps directions URL. Waypoints are the middle stops; works without any API key. */
export function directionsUrl(stops: { lat: number; lng: number }[], mode = 'walking'): string {
  if (!stops?.length) return ''
  const pt = (s: { lat: number; lng: number }) => `${s.lat},${s.lng}`
  const dest = stops[stops.length - 1]
  const params = new URLSearchParams({ api: '1', destination: pt(dest), travelmode: mode })
  if (stops.length > 1) params.set('origin', pt(stops[0]))
  if (stops.length > 2) params.set('waypoints', stops.slice(1, -1).map(pt).join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function stopDirectionsUrl(stop: { lat: number; lng: number }, mode = 'walking'): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=${mode}`
}
