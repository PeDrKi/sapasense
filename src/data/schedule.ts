// Opening constraints generated from the "Giờ mở cửa" column of sapa-lao-cai-dia-diem.xlsx.
// days: 0 = Sunday … 6 = Saturday. closeHour: last hour to start a visit.
export interface Opening { days?: number[]; openHour?: number; closeHour?: number }
export const SCHEDULE: Record<string, Opening> = {
  SP001: { closeHour:16 },  // 04:30–17:00
  SP002: { closeHour:15 },  // 07:30–16:30
  SP003: { closeHour:16 },  // 07:00–17:30
  SP004: { closeHour:17 },  // 07:00–18:00
  SP005: { closeHour:16 },  // 08:00–17:00
  AM001: { openHour:16 },  // 16:00–23:30
  AM002: { openHour:9 },  // 09:00–22:30
  AM004: { closeHour:19 },  // 05:30–20:00
  AM005: { closeHour:20 },  // 08:00–21:30
  AM007: { closeHour:17 },  // 07:30–18:00
  AM008: { closeHour:18 },  // 08:00–19:00
  AM009: { closeHour:20 },  // 06:30–21:30
  AM010: { closeHour:18 },  // 07:00–19:00
  AM011: { closeHour:20 },  // 08:00–21:00
  AM013: { closeHour:16 },  // 08:00–17:30
  AM014: { closeHour:20 },  // 07:30–21:00
  CF001: { closeHour:20 },  // 07:00–21:00
  CF002: { closeHour:19 },  // 08:00–20:00
  CF003: { closeHour:18 },  // 07:30–19:00
  SP021: { closeHour:17 },  // 06:00–18:00
  SP022: { closeHour:16 },  // 08:30–17:00
  SP023: { openHour:9, closeHour:17 },  // 09:00–18:00
  SP024: { closeHour:20 },  // 06:00–21:00
  SP025: { closeHour:20 },  // 06:00–21:00
  SP026: { openHour:10 },  // 10:00–22:00
  SP028: { closeHour:17 },  // 06:00–18:00
  SP029: { closeHour:17 },  // 07:00–18:00
  SP030: { closeHour:17 },  // 06:30–18:00
  SP031: { closeHour:17 },  // 07:30–18:00
  CF004: { closeHour:17 },  // 07:30–18:30
  SP032: { closeHour:16 },  // 07:00–17:30
}

export function isOpen(placeId: string, date: Date, startHour: number): boolean {
  const s = SCHEDULE[placeId]
  if (!s) return true
  if (s.days && !s.days.includes(date.getDay())) return false
  if (s.openHour != null && startHour < s.openHour - 1) return false
  if (s.closeHour != null && startHour >= s.closeHour) return false
  return true
}

// Tips written for one part of the day; swapped when the stop is scheduled at another time.
const TIME_TIPS: Record<string, { early: string | null; day: string | null; evening: string | null }> = {}
export function tipFor(place: { id: string; tip: string }, startHour: number): string {
  const t = TIME_TIPS[place.id]
  if (!t) return place.tip
  if (startHour >= 17) return t.evening ?? place.tip
  if (startHour >= 8)  return t.day ?? place.tip
  return t.early ?? place.tip
}
