export interface Address { text: string; short: string }

const cache = new Map<string, Address>()

/**
 * Đổi tọa độ → địa chỉ bằng OpenStreetMap Nominatim (miễn phí, giới hạn ~1 yêu cầu/giây; phải ghi nguồn OSM).
 * Chỉ gọi khi người dùng bấm nút. Tọa độ được gửi tới nominatim.openstreetmap.org.
 */
export async function reverseGeocode(lat: number, lng: number, lang: 'vi' | 'en' = 'vi', fetchFn: typeof fetch = fetch, timeoutMs = 8000): Promise<Address | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const key = `${lat.toFixed(4)},${lng.toFixed(4)},${lang}`
  const hit = cache.get(key); if (hit) return hit
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=${lang}&lat=${lat}&lon=${lng}`
    const r = await fetchFn(url, { signal: ctl.signal, headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    const j = await r.json() as { display_name?: string; address?: Record<string, string> }
    if (!j || !j.display_name) return null
    const a = j.address || {}
    const parts = [a.road, a.neighbourhood || a.quarter || a.suburb || a.hamlet || a.village, a.city || a.town || a.county, a.state].filter(Boolean)
    const out = { text: j.display_name, short: parts.length ? parts.join(', ') : j.display_name }
    cache.set(key, out); return out
  } catch { return null } finally { clearTimeout(timer) }
}
