import type { Weather } from '../types'
import { RAINY_CODES } from '../data/constants'

export const THUNDER_CODES = [95, 96, 99]
export const FOG_CODES = [45, 48]
export const CLEAR_CODES = [0, 1, 2]

/** Thresholds taken from the SapaSense report. */
export const HEAVY_RAIN_MM_H = 5
export const LOW_VISIBILITY_M = 500
export const COLD_C = 5

export type WxLevel = 'severe' | 'rain' | 'ok'

export interface WxInput { code?: number; precip?: number; visibility?: number; temp?: number | string }

export function wxInput(wx: Weather | null | undefined): WxInput {
  return { code: wx?.code, precip: wx?.precip, visibility: wx?.visibility, temp: wx?.temp }
}

/** severe: heavy rain / thunder / near-zero visibility → no outdoor stops. rain: light rain → no paid outdoor or free nature. */
export function wxLevel(w: WxInput): WxLevel {
  const code = w.code ?? 0
  if (THUNDER_CODES.includes(code)) return 'severe'
  if ((w.precip ?? 0) > HEAVY_RAIN_MM_H) return 'severe'
  if (w.visibility != null && w.visibility < LOW_VISIBILITY_M) return 'severe'
  if (RAINY_CODES.includes(code) || (w.precip ?? 0) >= 0.2) return 'rain'
  return 'ok'
}

export function numTemp(w: WxInput): number | null {
  const t = Number(w.temp)
  return w.temp === undefined || w.temp === '--' || !Number.isFinite(t) ? null : t
}

export function isCold(w: WxInput): boolean { const t = numTemp(w); return t !== null && t < COLD_C }

/** Score delta: outdoor +15 in nice weather; warm indoor service (cafe / spa / museum) +20 in rain or cold. */
export function weatherDelta(p: { indoor: boolean; type: string; name?: string }, w: WxInput): number {
  const level = wxLevel(w)
  const bad = level !== 'ok' || isCold(w)
  if (bad) {
    const warmService = p.type === 'cafe' || p.type === 'museum' || /spa|tắm lá|massage/i.test(p.name || '')
    if (p.indoor && warmService) return 20
    if (p.indoor) return 8
    return 0
  }
  const t = numTemp(w)
  const nice = CLEAR_CODES.includes(w.code ?? 0) && (t === null || (t >= 12 && t <= 28))
  return nice && !p.indoor ? 15 : 0
}

/** Does an existing stop still make sense under the current weather? (same rules as the recommender's hard filter) */
export function fitsWeather(p: { indoor: boolean; cost: number; type: string }, w: WxInput): boolean {
  const level = wxLevel(w)
  if (level === 'ok' || p.indoor) return true
  if (level === 'severe') return false
  return p.cost === 0 && p.type !== 'nature'
}
