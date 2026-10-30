import { getPlaces }              from '../data/placeStore'
import { mergeSeasonsIntoPlaces } from '../data/seasons'
import { mergeLocalMode }         from '../data/localMode'
import { isOpen, tipFor }         from '../data/schedule'
import { RAINY_CODES }            from '../data/constants'
import type { Answers, Place, Plan, Stop, TimedPlace, LatLng, Weather, TimeId, Focus, Mood, Group, GroupAnswer, Mode, Warn, Why } from '../types'

export interface Start { date: Date; startHour: number; nextDay: boolean }
export interface Scored { place: Place; score: number }
interface Cfg { target: number; minutes: number; radius: number }
interface PlanCtx { origin: LatLng | null; scored: Scored[]; all: Place[]; date: Date; startHour: number; wxCode: number; mood: Mood; mode: Mode; timeId: TimeId; group: GroupAnswer; budgetVal: number; month: number; focus: Focus }
type Located = LatLng
const isDef = <T,>(x: T | undefined | null): x is T => x != null

// target = max stops, minutes = total time budget (visits + travel), radius = max km from the anchor stop
export const STOPS_COUNT: Record<string, Cfg> = {
  // Sa Pa's sights are spread over ~30 km of mountain road (clusters: centre, Fansipan/Thác Tình Yêu, Tả Phìn, Séo Mý Tỷ, Ngũ Chỉ Sơn),
  // so the radii are much wider than in a flat city.
  '2h':  { target: 3, minutes: 185, radius: 4 },
  half:  { target: 4, minutes: 360, radius: 7 },
  full:  { target: 8, minutes: 600, radius: 30 },
}

const WEIGHTS = { mood: 0.35, group: 0.25, budget: 0.25, timeOfDay: 0.15 }

/** Budget slider steps (index = answer 1..5). Sa Pa prices run higher than a city break: treks and resort dining cost 1–1.5M. */
export const BUDGET_STEPS = [0, 200000, 500000, 800000, 1500000, 3000000]
export function getBudgetAmount(val: number): number {
  return BUDGET_STEPS[val] || 800000
}

export function getTimeOfDay(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 11) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

const LAST_START = 21   // do not start a stop after 21:00
const LAST_END   = 22.5 // nothing should end after 22:30
const FIRST_START = 8   // earliest start of a day plan
const TRAVEL_KMH = 20   // average speed on Sa Pa's mountain roads (taxi / motorbike / walking mix)

export function isRainyCode(code: number): boolean {
  return RAINY_CODES.includes(code)
}

/** Decide when the plan starts. Too late at night → tomorrow morning. */
export function resolveStart(now: Date): Start {
  const h = now.getHours() + now.getMinutes() / 60
  const date = new Date(now)
  let startHour = h, nextDay = false
  if (h >= LAST_START) {
    date.setDate(date.getDate() + 1)
    startHour = FIRST_START; nextDay = true
  } else if (h < FIRST_START) {
    startHour = FIRST_START
  }
  return { date, startHour, nextDay }
}

export function hardFilter(places: Place[], { budgetVal, timeId, wxCode, hour, date }: { budgetVal: number; timeId: string; wxCode: number; hour: number; date?: Date }): Place[] {
  const budget  = getBudgetAmount(budgetVal)
  const tod     = getTimeOfDay(hour)
  const isRainy = isRainyCode(wxCode)

  return places.filter(p => {
    if (p.type === 'lodging') return false   // hotels are listed under "Lưu trú", never scheduled as a stop
    if (date && !isOpen(p.id, date, hour)) return false
    if (p.cost > budget * 0.6) return false
    if (timeId !== 'full' && p.duration > (STOPS_COUNT[timeId] || STOPS_COUNT.half).minutes - 45) return false   // must leave room for at least one more short stop
    if (timeId !== 'full' && !p.timeOfDay.includes('any') && !p.timeOfDay.includes(tod)) return false
    if (isRainy && !p.indoor && p.cost > 0) return false
    return true
  })
}

export function scorePlace(place: Place, { mood, group, budgetVal, hour }: { mood: Mood; group: GroupAnswer; budgetVal: number; hour: number }): number {
  const budget = getBudgetAmount(budgetVal)
  const tod    = getTimeOfDay(hour)

  const moodScore = place.moods.includes(mood) ? 100 : 30
  const groupScore = group === 'any' ? 70                       // "gợi ý ngay": we do not know who is going
    : place.groups.includes(group) ? 100
    : (place.groups.includes('solo') && group === 'couple') ? 60 : 20
  let budgetScore = 0
  if (place.cost === 0)                  budgetScore = 100
  else if (place.cost <= budget * 0.2)   budgetScore = 90
  else if (place.cost <= budget * 0.4)   budgetScore = 70
  else if (place.cost <= budget * 0.6)   budgetScore = 50
  else                                   budgetScore = 10
  const timeScore = place.timeOfDay.includes('any') ? 70
    : place.timeOfDay.includes(tod) ? 100 : 20

  return (
    moodScore   * WEIGHTS.mood      +
    groupScore  * WEIGHTS.group     +
    budgetScore * WEIGHTS.budget    +
    timeScore   * WEIGHTS.timeOfDay
  )
}

export const AREA_PRESETS: Record<string, LatLng> = {
  trungtam:    { lat:22.3364, lng:103.8438 },   // thị xã Sa Pa
  hoanglien:   { lat:22.3167, lng:103.7667 },   // VQG Hoàng Liên / Fansipan
  ngochison:   { lat:22.4150, lng:103.7450 },   // Núi Ngũ Chỉ Sơn
  taphin:      { lat:22.3931, lng:103.8344 },   // Bản Tả Phìn
  seomyty:     { lat:22.2536, lng:103.8967 },   // Hồ Séo Mý Tỷ
}

/** A user position only counts when it is inside the Sa Pa area; otherwise it is ignored (never guessed). */
export function validOrigin(loc?: Partial<LatLng> | null): LatLng | null {
  const lat = Number(loc?.lat), lng = Number(loc?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < 22.15 || lat > 22.55 || lng < 103.6 || lng > 104.05) return null
  return { lat, lng }
}

export function selectPlaces(scored: Scored[], timeId: string, focus: Focus = 'all', origin: LatLng | null = null): Place[] {
  const cfg = STOPS_COUNT[timeId] || STOPS_COUNT.half
  const sorted = [...scored].sort((a, b) => b.score - a.score)
  const selected: Place[] = []
  const usedTypes: Record<string, number> = {}
  const usedAreas: Record<string, number> = {}
  let minutes = 0
  let anchor: Place | undefined = sorted[0]?.place
  if (focus !== 'all' && sorted.length > 1) {
    // single-type pools are small and spread out: anchor on the densest cluster rather than the single top scorer
    let best = -Infinity
    for (const c of sorted) {
      if (origin) break
      const near = sorted.filter(o => o !== c && distanceKm(c.place, o.place) <= cfg.radius).slice(0, cfg.target - 1)
      const val = c.score + near.reduce((a, o) => a + o.score, 0)
      if (val > best) { best = val; anchor = c.place }
    }
  }

  if (origin && sorted.length) {
    // start near the user: trade a little score for proximity (6 points per km)
    anchor = sorted.reduce((m, c) => (c.score - 6 * distanceKm(origin, c.place)) > (m.score - 6 * distanceKm(origin, m.place)) ? c : m, sorted[0]).place
  }

  const tryAdd = (place: Place, strict: boolean) => {
    if (selected.some(p => p.id === place.id)) return
    if (strict) {
      if (focus === 'all' && (usedTypes[place.type] || 0) >= 2) return   // a food-only plan is allowed to be all food
      if (focus === 'all' && (usedAreas[place.area] || 0) >= 3) return
    }
    if (anchor && distanceKm(anchor, place) > cfg.radius) return
    if (selected.length > 0 && minutes + place.duration + 10 > cfg.minutes) return
    selected.push(place)
    minutes += place.duration + 10
    usedTypes[place.type] = (usedTypes[place.type] || 0) + 1
    usedAreas[place.area] = (usedAreas[place.area] || 0) + 1
  }

  if (anchor) tryAdd(anchor, false)
  for (const item of sorted) { if (selected.length >= cfg.target) break; tryAdd(item.place, true) }
  for (const item of sorted) { if (selected.length >= cfg.target) break; tryAdd(item.place, false) }
  return selected
}

export function distanceKm(a: Located, b: Located): number {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
}

function nearestFrom<T extends Located>(first: T, rest: T[]): T[] {
  const remaining = [...rest]
  const route: T[] = [first]
  while (remaining.length > 0) {
    const last = route[route.length - 1]
    let nearest = 0, minDist = Infinity
    remaining.forEach((p, i) => { const d = distanceKm(last, p); if (d < minDist) { minDist = d; nearest = i } })
    route.push(remaining.splice(nearest, 1)[0])
  }
  return route
}

export function routeLength(route: Located[]): number {
  let sum = 0
  for (let i = 1; i < route.length; i++) sum += distanceKm(route[i - 1], route[i])
  return sum
}

/** Nearest-neighbour tried from every start point; keeps the shortest total path. */
export function optimizeRoute<T extends Located>(places: T[]): T[] {
  if (places.length <= 2) return places
  let best: T[] = places, bestLen = Infinity
  places.forEach((first, i) => {
    const rest = places.filter((_, j) => j !== i)
    const r = nearestFrom(first, rest)
    const len = routeLength(r)
    if (len < bestLen) { best = r; bestLen = len }
  })
  return best
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (h: number) => {
  const total = Math.round(h * 60)
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

export function roundUpQuarter(h: number): number { return Math.ceil(h * 4 - 1e-9) / 4 }
const roundQuarter = (h: number) => Math.round(h * 4) / 4
// at least 10 minutes between stops (walking, finding the entrance), longer when far apart
function travelHours(a: Located, b: Located): number { return Math.max(10, Math.round(distanceKm(a, b) / TRAVEL_KMH * 60)) / 60 }

export function fitsTime(place: Place, hour: number): boolean {
  return place.timeOfDay.includes('any') || place.timeOfDay.includes(getTimeOfDay(Math.floor(hour)))
}

/**
 * Order stops greedily (nearest neighbour) while keeping each stop inside its own good hours and opening days.
 * Travel time comes from real distance; stops that would end after 22:30 are dropped.
 */
export function scheduleStops(places: Place[], startHour: number, date?: Date | null, origin: LatLng | null = null): TimedPlace[] {
  const remaining = [...places]
  const out: TimedPlace[] = []
  let t = roundUpQuarter(startHour)
  let last: Place | null = null
  while (remaining.length) {
    const ready = remaining.filter(p => {
      const ts = last ? t + travelHours(last, p) : t
      return fitsTime(p, ts) && (!date || isOpen(p.id, date, ts))
    })
    if (!ready.length) {
      // nothing fits right now: wait for the next part of the day if it is not too long a gap
      const next = t < 11 ? 11 : t < 18 ? 18 : null
      if (next == null || next - t > 2 || next >= LAST_START) break
      t = next; last = null
      continue
    }
    let pick = ready[0]
    const from: Place | null = last
    if (from) pick = ready.reduce((m, p) => distanceKm(from, p) < distanceKm(from, m) ? p : m, ready[0])
    else if (origin) pick = ready.reduce((m, p) => distanceKm(origin, p) < distanceKm(origin, m) ? p : m, ready[0])
    const travel = last ? travelHours(last, pick) : 0
    const begin = roundUpQuarter(t + travel)
    const end = begin + pick.duration / 60
    remaining.splice(remaining.indexOf(pick), 1)
    if (begin >= LAST_START || end > LAST_END) continue
    out.push({ ...pick, time: `${fmt(begin)} - ${fmt(roundUpQuarter(end))}`, startAt: begin, order: out.length + 1, tip: tipFor(pick, begin) })
    t = end; last = pick
  }
  return out
}

/**
 * Schedule stops in exactly the given order (manual reordering). Nothing is dropped;
 * stops that clash with their good hours, opening days or the evening cut-off get a `warn` flag.
 */
export function scheduleInOrder(places: Place[], startHour: number, date?: Date | null): TimedPlace[] {
  let t = roundUpQuarter(startHour)
  let last: Place | null = null
  return places.map((pick, i) => {
    const begin = last ? roundUpQuarter(t + travelHours(last, pick)) : t
    const end = begin + pick.duration / 60
    let warn: Warn = null
    if (date && !isOpen(pick.id, date, begin)) warn = 'closed'
    else if (!fitsTime(pick, begin)) warn = 'hours'
    else if (end > LAST_END || begin >= LAST_START) warn = 'late'
    t = end; last = pick
    return { ...pick, time: `${fmt(begin)} - ${fmt(roundUpQuarter(end))}`, startAt: begin, order: i + 1, tip: tipFor(pick, begin), warn }
  })
}

/** Kept for callers that only need back-to-back slots (no hour/opening checks). */
export function generateTimeSlots(places: Place[], startHour: number) {
  let current = startHour
  const out: (Place & { time: string; order: number })[] = []
  places.forEach((place, i) => {
    if (i > 0) current += Math.max(5, Math.round(distanceKm(places[i - 1], place) / TRAVEL_KMH * 60)) / 60
    if (current >= LAST_START + 1) return
    const end = current + place.duration / 60
    out.push({ ...place, time: `${fmt(current)} - ${fmt(end)}`, order: out.length + 1 })
    current = end
  })
  return out
}

export function generateNarrative(mood: string, wxCode: number, focus: string = 'all'): string {
  const isRainy = isRainyCode(wxCode)
  const base = ({
    calm:      'Sa Pa hôm nay không cần đi đâu vội — chỉ cần một góc yên tĩnh giữa mây núi và một tách trà nóng là đủ.',
    adventure: 'Sa Pa luôn có những cung đường và góc khuất chờ bạn khám phá — hôm nay là ngày để đi xa hơn một chút.',
    nostalgia: 'Có những bản làng ở Sa Pa mà thời gian như đứng lại — hôm nay hãy tìm về những nơi đó.',
    energy:    'Ẩm thực Tây Bắc ở Sa Pa là cả một hành trình — hôm nay ăn đủ thứ, hỏi đủ chuyện.',
  } as Record<string, string>)[mood] || 'Sa Pa đang chờ bạn khám phá.'
  const f = ({ food:'Hôm nay là một hành trình để ăn — mỗi điểm dừng là một món đáng nhớ.', cafe:'Hôm nay là một hành trình cà phê — chậm rãi từ quán này sang quán khác.' } as Record<string, string>)[focus]
  const text = f || base
  return isRainy ? text + ' Trời mưa — những địa điểm trong nhà hôm nay sẽ đặc biệt hơn.' : text
}

/** The moment the plan is "for": honours an explicit start hour / tomorrow choice from onboarding. */
export function effectiveNow(answers?: Partial<Answers> | null, now: Date = new Date()): Date {
  const d = new Date(now)
  if (answers?.dayOffset) d.setDate(d.getDate() + answers.dayOffset)
  const sh = answers?.startHour
  if (typeof sh === 'number' && Number.isFinite(sh)) d.setHours(Math.floor(sh), Math.round((sh % 1) * 60), 0, 0)
  else if (answers?.dayOffset) d.setHours(FIRST_START, 0, 0, 0)
  return d
}

export function recommend({ answers, wx, now = new Date(), places = getPlaces(), exclude = [] }: { answers: Answers; wx: Weather | null; now?: Date; places?: Place[]; exclude?: string[] }): Plan {
  const base = effectiveNow(answers, now)
  const first = plan({ answers, wx, start: resolveStart(base), places, exclude })
  const explicit = Number.isFinite(answers?.startHour) || !!answers?.dayOffset
  // Sa Pa's sights are far apart, so a single stop is a legitimate daytime plan; only evening plans with <2 stops roll over to tomorrow
  if (first.stops.length >= 2 || (first.stops.length === 1 && first.startHour < 16) || first.startsTomorrow || explicit) return first
  // Too late to do anything sensible today → plan tomorrow morning
  const d = new Date(base); d.setDate(d.getDate() + 1)
  return plan({ answers, wx, start: { date: d, startHour: FIRST_START, nextDay: true }, places, exclude })
}

/** Everything both planning and swapping need: the scored candidate pool for a given start. */
// stable pseudo-random 0..1 for (seed, id): same day → same plan, new day / "Tạo lại" → different near-ties
function jitter(seed: string, id: string): number {
  let h = 2166136261
  const str = seed + '|' + id
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10000) / 10000
}
export const JITTER = 22

function prepare({ answers, wx, start, places, exclude = [] }: { answers: Answers; wx: Weather | null; start: Start; places: Place[]; exclude?: string[] }): PlanCtx {
  const { mood, budget: budgetVal, time: timeId, group, mode = 'tourist', focus = 'all' } = answers
  const wxCode = wx?.code ?? 0
  const { date, startHour } = start
  const hour   = Math.floor(startHour)
  const month  = date.getMonth() + 1
  const target = (STOPS_COUNT[timeId] || STOPS_COUNT.half).target

  const placesWithMode = mergeLocalMode(mergeSeasonsIntoPlaces(places), mode)
  const localBonus = (p: Place) => mode !== 'local' ? 0 : ((p.localScore || 1) - 1) * 4 + (p.hiddenGem ? 10 : 0)

  const focusOk = (p: Place) => focus === 'all' || p.type === focus
  let filtered = hardFilter(placesWithMode.filter(focusOk), { budgetVal, timeId, wxCode, hour, date })
  if (filtered.length < target) {
    // relax budget/time but never opening days
    filtered = placesWithMode.filter(p => focusOk(p) && p.cost <= getBudgetAmount(budgetVal) * 0.8 && isOpen(p.id, date, hour))
  }
  filtered = filtered.filter(p => !exclude.includes(p.id))
  const hidden = new Set(answers.hidden || [])
  if (hidden.size) filtered = filtered.filter(p => !hidden.has(p.id))
  if (focus !== 'all') filtered = filtered.filter(p => p.type === focus)   // 'food' | 'cafe'
  // honour the chosen mood only when the matching pool is large enough that plans still have neighbours to chain
  // (Sa Pa has few sights spread far apart, so a strict mood filter would leave one-stop plans)
  const onMood = filtered.filter(p => p.moods.includes(mood))
  if (onMood.length >= target + 6) filtered = onMood

  const recent = new Set(answers.recent || []), visited = new Set(answers.visited || []), favs = new Set(answers.favs || [])
  const scored = filtered.map(place => ({
    place,
    score: scorePlace(place, { mood, group, budgetVal, hour })
         + (place.bestMonths?.includes(month) ? 8 : 0)
         + (place.peakMonths?.length && place.peakMonths.length < (place.bestMonths?.length || 12) && place.peakMonths.includes(month) ? 6 : 0)
         + localBonus(place)
         + jitter(`${localISO(date)}|${getTimeOfDay(hour)}|${answers.seed || 0}|${timeId}`, place.id) * JITTER
         + (favs.has(place.id) ? 10 : 0)
         - (recent.has(place.id) ? 14 : 0)
         - (visited.has(place.id) ? (place.type === 'food' || place.type === 'cafe' ? 8 : 24) : 0),
  }))
  const origin = validOrigin(answers.loc)
  return { origin, scored, all: placesWithMode, date, startHour, wxCode, mood, mode, timeId, group, budgetVal, month, focus }
}

/** yyyy-mm-dd in the user's own time zone (toISOString would use UTC and shift the day before 07:00 in Vietnam). */
export function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Why a stop was picked — short, honest reasons derived from the same facts the scorer uses. */
export function reasonsFor(place: Place & { startAt?: number }, ctx: Pick<PlanCtx, 'mood' | 'group' | 'wxCode' | 'mode' | 'month' | 'budgetVal' | 'startHour'>): Why[] {
  const why: Why[] = []
  if (place.moods?.includes(ctx.mood)) why.push({ k:'mood' })
  if (place.groups?.includes(ctx.group as Group)) why.push({ k:'group' })
  if (isRainyCode(ctx.wxCode) && place.indoor) why.push({ k:'indoorRain' })
  if (place.hiddenGem && ctx.mode === 'local') why.push({ k:'hidden' })
  if (place.peakMonths?.length && place.peakMonths.length < (place.bestMonths?.length || 12) && place.peakMonths.includes(ctx.month)) why.push({ k:'peak', v:ctx.month })
  if (place.cost === 0) why.push({ k:'free' })
  else if (place.cost <= getBudgetAmount(ctx.budgetVal) * 0.2) why.push({ k:'cheap' })
  if (place.timeOfDay?.includes(getTimeOfDay(Math.floor(place.startAt ?? ctx.startHour))) && !place.timeOfDay.includes('any')) why.push({ k:'time' })
  return why.slice(0, 3)
}

function toResult(ctx: PlanCtx, nextDay: boolean, withTime: TimedPlace[]): Plan {
  return {
    narrative: generateNarrative(ctx.mood, ctx.wxCode, ctx.focus),
    mode: ctx.mode,
    startsTomorrow: nextDay,
    startHour: ctx.startHour,
    dateISO: localISO(ctx.date),
    stops: withTime.map(p => ({
      id: p.id, name: p.name, time: p.time, startAt: p.startAt, desc: p.desc, badges: p.badges,
      img: p.img || null, imgCredit: p.imgCredit || null, lat: p.lat, lng: p.lng, tip: p.tip, area: p.area, cost: p.cost, type: p.type, indoor: p.indoor,
      localScore: p.localScore, hiddenGem: p.hiddenGem, displayTime: p.displayTime, warn: p.warn || null,
      why: reasonsFor(p, ctx),
      distKm: ctx.origin ? Math.round(distanceKm(ctx.origin, p) * 10) / 10 : null,
      menu: p.menu || null, menuSrc: p.menuSrc || null, menuChecked: p.menuChecked || '', menuNote: p.menuNote || '', priceQuality: p.priceQuality || null,
    })),
  }
}

function plan({ answers, wx, start, places, exclude }: { answers: Answers; wx: Weather | null; start: Start; places: Place[]; exclude?: string[] }): Plan {
  const ctx = prepare({ answers, wx, start, places, exclude })
  const selected = selectPlaces(ctx.scored, ctx.timeId, ctx.focus, ctx.origin)
  return toResult(ctx, start.nextDay, scheduleStops(selected, ctx.startHour, ctx.date, ctx.origin))
}

function startFor(_answers: Answers, result: Plan, _now?: Date): Start {
  // Re-use the start of the plan being edited so swaps never shift the whole day.
  const d = new Date(`${result.dateISO}T12:00:00`)
  return { date: d, startHour: result.startHour, nextDay: result.startsTomorrow }
}

/**
 * Replace one stop by the best alternative that still fits the plan.
 * Returns a new result, or null when nothing suitable exists.
 */
export function swapStop({ answers, wx, result, stopId, places = getPlaces(), exclude = [], now = new Date() }: { answers: Answers; wx: Weather | null; result: Plan; stopId: string; places?: Place[]; exclude?: string[]; now?: Date }): Plan | null {
  const start = startFor(answers, result, now)
  const ctx = prepare({ answers, wx, start, places, exclude: [...exclude, stopId] })
  const keepIds = result.stops.filter(s => s.id !== stopId).map(s => s.id)
  const kept = keepIds.map(id => ctx.all.find(p => p.id === id)).filter(isDef)
  const cfg = STOPS_COUNT[answers.time] || STOPS_COUNT.half
  const candidates = [...ctx.scored]
    .filter(c => !keepIds.includes(c.place.id))
    .sort((a, b) => b.score - a.score)

  const idx = result.stops.findIndex(s => s.id === stopId)
  for (const { place } of candidates) {
    if (kept.length && kept.some(k => distanceKm(k, place) > cfg.radius * 1.2)) continue
    const order = result.stops.map(s => s.id === stopId ? place : ctx.all.find(p => p.id === s.id)).filter(isDef)
    const timed = scheduleInOrder(order, ctx.startHour, ctx.date)
    if (timed.length === result.stops.length && !timed[idx]?.warn && timed.every((t, i) => i === idx || !t.warn || result.stops[i]?.warn)) {
      return toResult(ctx, start.nextDay, timed)
    }
  }
  return null
}

/** Rebuild a plan from a saved list of place ids (shared link / reload). */
export function rebuildPlan({ answers, wx, ids, startHour, dateISO, places = getPlaces(), now = new Date() }: { answers: Answers; wx: Weather | null; ids: string[]; startHour?: number | null; dateISO?: string | null; places?: Place[]; now?: Date }): Plan {
  const base = effectiveNow(answers, now)
  const start = resolveStart(base)
  if (startHour != null && Number.isFinite(startHour)) start.startHour = startHour
  if (dateISO) start.date = new Date(`${dateISO}T12:00:00`)
  const ctx = prepare({ answers, wx, start, places })
  const chosen = ids.map(id => ctx.all.find(p => p.id === id)).filter(isDef)
  if (!chosen.length) return recommend({ answers, wx, now, places })
  return toResult(ctx, start.nextDay, scheduleStops(chosen, ctx.startHour, ctx.date, ctx.origin))
}

/** Move one stop up (-1) or down (+1); times are recalculated, clashes are flagged not hidden. */
export function moveStop({ answers, wx, result, stopId, dir, places = getPlaces() }: { answers: Answers; wx: Weather | null; result: Plan; stopId: string; dir: number; places?: Place[] }): Plan {
  const i = result.stops.findIndex(s => s.id === stopId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= result.stops.length) return result
  const ids = result.stops.map(s => s.id)
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  const start = startFor(answers, result)
  const ctx = prepare({ answers, wx, start, places })
  const order = ids.map(id => ctx.all.find(p => p.id === id)).filter(isDef)
  return toResult(ctx, start.nextDay, scheduleInOrder(order, ctx.startHour, ctx.date))
}
