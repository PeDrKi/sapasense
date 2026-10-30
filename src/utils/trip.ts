import { distanceKm } from './recommend'
import type { LatLng } from '../types'

type Timed = { time: string; cost?: number }

/** Travel between two stops: walk when close, otherwise a bike/taxi style estimate. */
export function legInfo(a: LatLng, b: LatLng): { km: number; minutes: number; mode: 'walk' | 'ride' } {
  const km = distanceKm(a, b)
  const walk = km <= 1.2
  const minutes = Math.max(2, Math.round(km / (walk ? 4.5 : 18) * 60) + (walk ? 0 : 5))
  return { km, minutes, mode: walk ? 'walk' : 'ride' }
}

export function tripSummary(stops: (LatLng & Timed)[]) {
  let km = 0, move = 0
  for (let i = 1; i < stops.length; i++) { const l = legInfo(stops[i - 1], stops[i]); km += l.km; move += l.minutes }
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const first = stops[0]?.time?.split(' - ')[0], last = stops.at(-1)?.time?.split(' - ')[1]
  const span = first && last ? toMin(last) - toMin(first) : 0
  const tickets = stops.reduce((a, s) => a + (s.cost || 0), 0)
  return { count: stops.length, km, move, span, tickets }
}

export function fmtKm(km: number): string { return km < 1 ? `${Math.round(km * 10) * 100} m` : `${km.toFixed(1).replace('.', ',')} km` }
export function fmtDur(min: number): string { const h = Math.floor(min / 60), m = min % 60; return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} phút` }

/** Is `nowHour` (decimal) inside / before this stop's time window? */
export function stopState(stop: { time: string }, nowHour: number): 'now' | 'upcoming' | 'past' {
  const [a, b] = stop.time.split(' - ').map((t: string) => { const [h, m] = t.split(':').map(Number); return h + m / 60 })
  if (nowHour >= a && nowHour < b) return 'now'
  if (nowHour < a) return 'upcoming'
  return 'past'
}
