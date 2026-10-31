export interface DayForecast { date: string; tMax: number; tMin: number; rainProb: number; rainMm: number; code: number; uv: number; wind: number }

const URL = 'https://api.open-meteo.com/v1/forecast?latitude=22.3364&longitude=103.8438&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,uv_index_max,wind_speed_10m_max&forecast_days=4&timezone=Asia%2FBangkok'
const KEY = 'ss_forecast'

export function parseForecast(data: any): DayForecast[] {
  const d = data?.daily
  if (!d?.time) return []
  return d.time.map((date: string, i: number) => ({
    date, code: Number(d.weather_code?.[i] ?? 0),
    tMax: Math.round(d.temperature_2m_max?.[i]), tMin: Math.round(d.temperature_2m_min?.[i]),
    rainProb: Number(d.precipitation_probability_max?.[i] ?? 0), rainMm: Number(d.precipitation_sum?.[i] ?? 0),
    uv: Number(d.uv_index_max?.[i] ?? 0), wind: Number(d.wind_speed_10m_max?.[i] ?? 0),
  })).filter((x: DayForecast) => Number.isFinite(x.tMax) && Number.isFinite(x.tMin))
}

/** Network first; falls back to the last forecast saved on this device (so it still shows offline, marked as old). */
export async function fetchForecast(): Promise<{ days: DayForecast[]; stale: boolean }> {
  try {
    const res = await fetch(URL)
    if (!res.ok) throw new Error('forecast ' + res.status)
    const days = parseForecast(await res.json())
    if (days.length) { try { localStorage.setItem(KEY, JSON.stringify({ days, at: Date.now() })) } catch { /* ignore */ } }
    return { days, stale: false }
  } catch {
    try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c?.days?.length) return { days: c.days, stale: true } } catch { /* ignore */ }
    return { days: [], stale: true }
  }
}
