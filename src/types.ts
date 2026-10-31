export type Mood = 'calm' | 'adventure' | 'nostalgia' | 'energy'
export type Group = 'solo' | 'couple' | 'friends' | 'family'
export type GroupAnswer = Group | 'any'
export type PlaceType = 'attraction' | 'food' | 'cafe' | 'museum' | 'nature' | 'market' | 'lodging'
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'any'
export type TimeId = '2h' | 'half' | 'full'
export type Focus = 'all' | 'food' | 'cafe'
export type Mode = 'tourist' | 'local'
export type PriceQuality = 'menu' | 'partial' | 'est'

export interface MenuItem { n: string; p: number }
export interface MenuEntry { q: 'menu' | 'partial'; checked?: string; items: MenuItem[]; src?: string[]; note?: string }

export interface RawPlace {
  id: string; name: string; area: string; lat: number; lng: number
  type: PlaceType; moods: Mood[]; groups: Group[]; indoor: boolean
  timeOfDay: TimeOfDay[]; duration: number; cost: number
  desc: string; badges: string[]; tip: string
  hours?: string; address?: string; closedNote?: string; note?: string   // giờ mở cửa "HH:MM–HH:MM" hoặc "24/24", địa chỉ, ngày nghỉ
  img?: string; imgCredit?: string   // ảnh: URL hoặc tên file trong public/places/ (mặc định public/places/<id>.webp)
}
export interface Place extends RawPlace {
  priceQuality?: PriceQuality
  menu?: MenuItem[]; menuSrc?: string[]; menuChecked?: string; menuNote?: string
  bestMonths?: number[]; peakMonths?: number[]; season?: string
  localScore?: number; hiddenGem?: boolean; displayTime?: string | null
}

export interface LatLng { lat: number; lng: number }
/** A starting point chosen by the user: GPS fix or a preset area. */
export interface Loc extends LatLng { src?: 'gps' | 'area'; area?: string; label?: string }
export interface Weather { code?: number; temp?: number | string; icon?: string; label?: string; precip?: number; visibility?: number }

/** Everything the recommender needs to know about the user's wishes. */
export interface Answers {
  mood: Mood
  budget: number            // TỔNG ngân sách (VND) cho cả nhóm; số 1..5 = mức cũ (mỗi người)
  fitness?: 'normal' | 'limited'   // thể lực: 'limited' → bỏ các điểm đi bộ/leo vất vả
  allergies?: string[]             // 'seafood' | 'peanut' | 'dairy' | 'gluten' | 'egg'
  motionSick?: boolean             // dễ say xe → lộ trình gần, ít đường đèo
  people?: number           // số người đi (mặc định 1)
  time: TimeId
  group: GroupAnswer
  mode?: Mode
  focus?: Focus
  auto?: boolean
  why?: string[]
  seed?: number | string
  loc?: Loc | null
  dayOffset?: number
  startHour?: number
  hidden?: string[]
  recent?: string[]
  visited?: string[]
  favs?: string[]
}

export type Warn = 'closed' | 'hours' | 'late' | null
export interface Why { k: string; v?: number }

export interface Stop {
  id: string; name: string; time: string; startAt: number; desc: string; badges: string[]
  lat: number; lng: number; tip: string; area: string; cost: number; type: PlaceType; indoor: boolean
  localScore?: number; hiddenGem?: boolean; displayTime?: string | null; warn: Warn
  why: Why[]; distKm: number | null
  menu: MenuItem[] | null; menuSrc: string[] | null; menuChecked: string; menuNote: string
  priceQuality: PriceQuality | null
  img?: string | null; imgCredit?: string | null
}

export interface Plan {
  narrative: string; mode: Mode; startsTomorrow: boolean; startHour: number; dateISO: string
  stops: Stop[]
}

/** Place after scheduling (before turning into a Stop). */
export interface TimedPlace extends Place { time: string; startAt: number; order: number; warn?: Warn }

export interface Review { date?: string; mood?: string; timeLabel?: string; groupLabel?: string; budgetLabel?: string; ratings?: Record<string, number>; comment?: string; stops?: string[] }

// ── memory ──
export interface Mark { t: number; on: boolean }
export type MarkKind = 'fav' | 'visited' | 'hidden'
export interface MemoryState {
  v: 2
  marks: Record<MarkKind, Record<string, Mark>>
  shown: Record<string, string>
  history: Record<string, { ids: string[]; t: number }>
}
