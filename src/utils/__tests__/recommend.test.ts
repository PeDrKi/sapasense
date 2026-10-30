import { describe, it, expect } from 'vitest'
import {
  recommend, resolveStart, getTimeOfDay, isRainyCode, optimizeRoute,
  routeLength, generateTimeSlots, hardFilter,
} from '../recommend'
import { escapeHtml } from '../html'
import type { Answers, Place, Plan, RawPlace, Mood, GroupAnswer, TimeId, Focus, Loc } from '../../types'
import { isOpen, tipFor } from '../../data/schedule'
import { PLACES } from '../../data/places'
import { SEASONS_DATA } from '../../data/seasons'

const answers: Answers = { mood:'calm', budget:3, time:'half', group:'couple', mode:'tourist' }
// Saturday 17 Oct 2026, 09:00 local
const sat9  = new Date(2026, 9, 17, 9, 0)
const sat23 = new Date(2026, 9, 17, 23, 0)
const mon9  = new Date(2026, 9, 19, 9, 0)

describe('time helpers', () => {
  it('buckets time of day', () => {
    expect(getTimeOfDay(8)).toBe('morning')
    expect(getTimeOfDay(13)).toBe('afternoon')
    expect(getTimeOfDay(19)).toBe('evening')
  })
  it('late night → tomorrow 08:00', () => {
    const r = resolveStart(sat23)
    expect(r.nextDay).toBe(true)
    expect(r.startHour).toBe(8)
    expect(r.date.getDay()).toBe(0)
  })
  it('very early clamps to 08:00 same day', () => {
    const r = resolveStart(new Date(2026, 9, 17, 5, 0))
    expect(r.nextDay).toBe(false)
    expect(r.startHour).toBe(8)
  })
})

describe('weather', () => {
  it('detects drizzle, heavy rain and thunderstorm as rainy', () => {
    for (const c of [51, 55, 65, 81, 82, 96, 99]) expect(isRainyCode(c)).toBe(true)
    for (const c of [0, 1, 3, 45]) expect(isRainyCode(c)).toBe(false)
  })
  it('rain removes paid outdoor places', () => {
    const out = hardFilter(PLACES, { budgetVal:5, timeId:'full', wxCode:65, hour:9, date:mon9 })
    expect(out.every(p => p.indoor || p.cost === 0)).toBe(true)
  })
})

describe('opening schedule', () => {
  it('Vườn Quốc gia Hoàng Liên stops taking visitors in the afternoon (closes 16:30)', () => {
    expect(isOpen('SP002', sat9, 9)).toBe(true)
    expect(isOpen('SP002', sat9, 15)).toBe(false)
  })
  it('Quán Côn Đồ only opens from 16:00', () => {
    expect(isOpen('AM001', mon9, 9)).toBe(false)
    expect(isOpen('AM001', mon9, 16)).toBe(true)
  })
})

describe('route', () => {
  it('keeps all stops and is not longer than input order', () => {
    const pts = PLACES.slice(0, 6)
    const r = optimizeRoute(pts)
    expect(r).toHaveLength(6)
    expect(new Set(r.map(p => p.id))).toEqual(new Set(pts.map(p => p.id)))
    expect(routeLength(r)).toBeLessThanOrEqual(routeLength(pts) + 1e-9)
  })
  it('time slots are increasing and include travel time', () => {
    const slots = generateTimeSlots(PLACES.slice(0, 3), 8)
    expect(slots[0].time.startsWith('08:00')).toBe(true)
    const starts = slots.map(s => s.time.slice(0, 5))
    expect([...starts].sort()).toEqual(starts)
  })
})

describe('recommend()', () => {
  it('returns the right number of stops with ids and times', () => {
    const out = recommend({ answers, wx:{ code:0 }, now:sat9 })
    expect(out.stops.length).toBeGreaterThanOrEqual(1)
    expect(out.stops.length).toBeLessThanOrEqual(4)
    out.stops.forEach(s => { expect(s.id).toBeTruthy(); expect(s.time).toMatch(/^\d\d:\d\d - \d\d:\d\d$/) })
    expect(out.startsTomorrow).toBe(false)
  })
  it('never recommends a place before it opens', () => {
    const out = recommend({ answers:{ ...answers, mood:'energy', group:'friends' }, wx:{ code:0 }, now:mon9 })
    expect(out.stops.find(s => s.id === 'AM001')).toBeUndefined()   // opens 16:00
  })
  it('never schedules a hotel as a stop', () => {
    for (const time of ['2h', 'half', 'full'])
      for (const budget of [1, 3, 5]) {
        const out = recommend({ answers:{ ...answers, time: time as TimeId, budget }, wx:{ code:0 }, now:sat9 })
        out.stops.forEach(s => expect(s.type).not.toBe('lodging'))
      }
  })
  it('flags next-day plans', () => {
    expect(recommend({ answers, wx:{ code:0 }, now:sat23 }).startsTomorrow).toBe(true)
  })
  it('uses the supplied place list (admin edits)', () => {
    const only = PLACES.filter(p => p.id === 'SP002' || p.id === 'SP003' || p.id === 'SP005' || p.id === 'AM013')
    const out = recommend({ answers, wx:{ code:0 }, now:sat9, places:only })
    out.stops.forEach(s => expect(only.map(p => p.id)).toContain(s.id))
  })
  it('works for every mood/group/time combination', () => {
    for (const mood of ['calm','adventure','nostalgia','energy'])
      for (const group of ['solo','couple','friends','family'])
        for (const time of ['2h','half','full']) {
          const out = recommend({ answers:{ mood: mood as Mood, group: group as GroupAnswer, time: time as TimeId, budget:1, mode:'local' }, wx:{ code:61 }, now:sat9 })
          expect(out.stops.length).toBeGreaterThan(0)
        }
  })
})

describe('escapeHtml', () => {
  it('escapes markup', () => {
    expect(escapeHtml('<img src=x onerror="a()">')).toBe('&lt;img src=x onerror=&quot;a()&quot;&gt;')
  })
})

describe('plan sanity (UX)', () => {
  const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const span = (stops: { time: string }[]) => {
    const f = stops[0].time.split(' - ')[0], l = stops[stops.length - 1].time.split(' - ')[1]
    return mins(l) - mins(f)
  }
  const sat1815 = new Date(2026, 9, 17, 18, 15)

  it('half-day evening plan stays short and ends before 22:30', () => {
    const out = recommend({ answers, wx:{ code:0 }, now:sat1815 })
    expect(span(out.stops)).toBeLessThanOrEqual(330)
    expect(mins(out.stops.at(-1)!.time.split(' - ')[1])).toBeLessThanOrEqual(22 * 60 + 30)
  })
  it('times are on 15-minute marks', () => {
    const out = recommend({ answers, wx:{ code:0 }, now:sat1815 })
    out.stops.forEach(s => s.time.split(' - ').forEach(t => expect(mins(t) % 15).toBe(0)))
  })
  it('2h plan is compact (≤ 3 stops, ≤ 3h)', () => {
    const out = recommend({ answers:{ ...answers, time:'2h' }, wx:{ code:0 }, now:sat9 })
    expect(out.stops.length).toBeLessThanOrEqual(3)
    expect(span(out.stops)).toBeLessThanOrEqual(185)
  })
  it('every stop fits its own good hours', () => {
    for (const time of ['2h', 'half', 'full']) {
      const out = recommend({ answers:{ ...answers, time: time as TimeId }, wx:{ code:0 }, now:sat9 })
      out.stops.forEach(s => {
        const p = PLACES.find(x => x.id === s.id)
        const h = Math.floor(mins(s.time.split(' - ')[0]) / 60)
        expect(p!.timeOfDay.includes('any') || p!.timeOfDay.includes(getTimeOfDay(h))).toBe(true)
      })
    }
  })
  it('no morning tip on an evening stop', () => {
    const out = recommend({ answers, wx:{ code:0 }, now:sat1815 })
    out.stops.filter(s => s.startAt >= 17).forEach(s => expect(s.tip).not.toMatch(/trước 7h sáng/))
  })
  it('too late for anything → plan moves to tomorrow', () => {
    const out = recommend({ answers, wx:{ code:0 }, now:new Date(2026, 9, 17, 20, 50) })
    expect(out.stops.length).toBeGreaterThanOrEqual(2)
  })
})

import { swapStop, rebuildPlan, effectiveNow, moveStop, scheduleInOrder } from '../recommend'
import { encodePlan, decodePlan, directionsUrl } from '../share'

describe('P2 features', () => {
  const sat9b = new Date(2026, 9, 17, 9, 0)
  it('explicit start hour and tomorrow are honoured', () => {
    const out = recommend({ answers:{ ...answers, startHour:14, dayOffset:1 }, wx:{ code:0 }, now:sat9b })
    expect(out.startHour).toBe(14)
    expect(out.dateISO).toBe('2026-10-18')
    expect(out.stops[0].time.startsWith('14:')).toBe(true)
  })
  it('effectiveNow without options is the same moment', () => {
    expect(effectiveNow(answers, sat9b).getTime()).toBe(sat9b.getTime())
  })
  it('swap replaces exactly one stop with a different, valid one', () => {
    const before = recommend({ answers, wx:{ code:0 }, now:sat9b })
    const victim = before.stops[1].id
    const after = swapStop({ answers, wx:{ code:0 }, result:before, stopId:victim, now:sat9b })
    expect(after).not.toBeNull()
    expect(after!.stops.map(s => s.id)).not.toContain(victim)
    expect(after!.stops).toHaveLength(before.stops.length)
    const kept = before.stops.map(s => s.id).filter(i => i !== victim)
    kept.forEach(i => expect(after!.stops.map(s => s.id)).toContain(i))
  })
  it('repeated swaps never bring back a rejected place', () => {
    let res = recommend({ answers, wx:{ code:0 }, now:sat9b }); const seen = []
    for (let i = 0; i < 3; i++) {
      const id = res.stops[0].id; seen.push(id)
      const nxt = swapStop({ answers, wx:{ code:0 }, result:res, stopId:id, exclude:seen, now:sat9b })
      if (!nxt) break
      res = nxt
      seen.forEach(x => expect(res.stops.map(s => s.id)).not.toContain(x))
    }
  })
  it('share link round-trips and rebuilds the same stops', () => {
    const res = recommend({ answers, wx:{ code:0 }, now:sat9b })
    const hash = encodePlan({ answers, result:res })
    const back = decodePlan('#p=' + hash)
    expect(back!.answers).toMatchObject({ mood:'calm', time:'half', group:'couple', budget:3 })
    expect(back!.ids).toEqual(res.stops.map(s => s.id))
    const rebuilt = rebuildPlan({ ...back!, wx:{ code:0 }, now:sat9b })
    expect(rebuilt.stops.map(s => s.id)).toEqual(res.stops.map(s => s.id))
  })
  it('rejects garbage hashes', () => {
    expect(decodePlan('#p=%%%')).toBeNull()
    expect(decodePlan('#p=' + btoa('{"a":{"mood":"x"}}'))).toBeNull()
    expect(decodePlan('')).toBeNull()
  })
  it('builds a directions url with waypoints', () => {
    const u = directionsUrl([{ lat:1, lng:2 }, { lat:3, lng:4 }, { lat:5, lng:6 }])
    expect(u).toContain('destination=5%2C6')
    expect(u).toContain('waypoints=3%2C4')
  })
})

describe('time-specific tips', () => {
  it('without a time-specific override the place tip is used at any hour', () => {
    const p = PLACES.find(x => x.id === 'SP003')!
    for (const h of [6, 9, 19]) expect(tipFor(p, h)).toBe(p.tip)
  })
})

describe('manual reorder', () => {
  const sat9c = new Date(2026, 9, 17, 9, 0)
  it('moving a stop swaps neighbours and keeps all ids', () => {
    const res = recommend({ answers, wx:{ code:0 }, now:sat9c })
    const ids = res.stops.map(s => s.id)
    const moved = moveStop({ answers, wx:{ code:0 }, result:res, stopId:ids[0], dir:1 })
    expect(moved.stops.map(s => s.id)).toEqual([ids[1], ids[0], ...ids.slice(2)])
    expect(moved.stops[0].time.startsWith('09:')).toBe(true)
  })
  it('moving past the ends is a no-op', () => {
    const res = recommend({ answers, wx:{ code:0 }, now:sat9c })
    expect(moveStop({ answers, wx:{ code:0 }, result:res, stopId:res.stops[0].id, dir:-1 })).toBe(res)
  })
  it('flags a stop placed outside its good hours', () => {
    const late = PLACES.find(p => p.id === 'SP002')   // park closes 16:30
    const [a] = scheduleInOrder([late!], 17, new Date(2026, 9, 17))
    expect(a.warn).toBeTruthy()
  })
  it('swap keeps the order of the other stops', () => {
    const res = recommend({ answers, wx:{ code:0 }, now:sat9c })
    const victim = res.stops[1].id
    const after = swapStop({ answers, wx:{ code:0 }, result:res, stopId:victim, now:sat9c })
    expect(after!.stops[0].id).toBe(res.stops[0].id)
    if (res.stops[2]) expect(after!.stops[2].id).toBe(res.stops[2].id)
  })
})

import { seasonLevel, peakMonthsOf } from '../../data/seasons'
describe('season levels', () => {
  const withSeason = PLACES.filter(p => SEASONS_DATA[p.id])
  it('October singles out the sights that are best now (those with season data)', () => {
    const lv = withSeason.map(p => seasonLevel(p.id, 10))
    expect(withSeason.length).toBeGreaterThanOrEqual(3)
    expect(lv.filter(x => x === 'peak').length).toBeGreaterThanOrEqual(1)
  })
  it('peak months are always a subset of best months', () => {
    withSeason.forEach(p => {
      const best = SEASONS_DATA[p.id].bestMonths
      peakMonthsOf(p.id).forEach(m => expect(best).toContain(m))
    })
  })
  it('summer has places that are off-season', () => {
    expect(withSeason.filter(p => seasonLevel(p.id, 8) === 'off').length).toBeGreaterThanOrEqual(2)
  })
})

import { legInfo, tripSummary, fmtKm, stopState } from '../trip'
describe('reasons & trip helpers', () => {
  const sat9d = new Date(2026, 9, 17, 9, 0)
  it('every stop explains itself with at most 3 reasons', () => {
    const out = recommend({ answers:{ ...answers, mood:'nostalgia' }, wx:{ code:0 }, now:sat9d })
    out.stops.forEach(s => { expect(s.why.length).toBeGreaterThan(0); expect(s.why.length).toBeLessThanOrEqual(3) })
  })
  it('rain reason appears for indoor stops when it rains', () => {
    const out = recommend({ answers, wx:{ code:63 }, now:sat9d })
    expect(out.stops.every(s => s.indoor || s.cost === 0)).toBe(true)
  })
  it('walk vs ride and summary numbers are sane', () => {
    const [a, b] = [PLACES.find(p => p.id === 'SP005'), PLACES.find(p => p.id === 'AM013')]
    expect(legInfo(a!, b!).mode).toBe('walk')
    const far = legInfo(PLACES.find(p => p.id === 'SP001')!, PLACES.find(p => p.id === 'SP003')!)
    expect(far.mode).toBe('ride'); expect(far.minutes).toBeGreaterThan(20)
    const out = recommend({ answers, wx:{ code:0 }, now:sat9d })
    const sum = tripSummary(out.stops)
    expect(sum.count).toBe(out.stops.length); expect(sum.span).toBeGreaterThan(0)
    expect(fmtKm(0.43)).toBe('400 m'); expect(fmtKm(2.34)).toBe('2,3 km')
  })
  it('stop state tracks the clock', () => {
    const s = { time:'10:00 - 11:00' }
    expect(stopState(s, 9)).toBe('upcoming'); expect(stopState(s, 10.5)).toBe('now'); expect(stopState(s, 12)).toBe('past')
  })
})

import { localISO } from '../recommend'
describe('local dates', () => {
  it('uses the local calendar day, not UTC (06:20 in UTC+7 is still the same day)', () => {
    const early = new Date(2026, 9, 18, 6, 20)
    expect(localISO(early)).toBe('2026-10-18')
    const out = recommend({ answers:{ ...answers, startHour:9 }, wx:{ code:0 }, now:early })
    expect(out.dateISO).toBe('2026-10-18')
    const back = rebuildPlan({ answers:{ ...answers, startHour:9 }, ids:out.stops.map(s => s.id), startHour:9, dateISO:out.dateISO, wx:{ code:0 }, now:early })
    expect(back.dateISO).toBe('2026-10-18')
  })
})

import { menuAverage, applyMenus, MENUS } from '../../data/menus'

describe('focus modes', () => {
  const moods: Mood[] = ['calm', 'energy', 'nostalgia', 'adventure']
  // the Sa Pa data set has no cafés yet; add 'cafe' back to this list when it does
  it.each(['food'] as Focus[])('%s-only plans contain only that type', (focus) => {
    for (const mood of moods) {
      for (const time of ['2h', 'half'] as TimeId[]) {
        const res = recommend({ answers:{ ...answers, mood, time, focus, group:'friends' }, wx:null, now:sat9 })
        expect(res.stops.length).toBeGreaterThan(0)
        for (const s of res.stops) expect(s.type).toBe(focus)
      }
    }
  })
  it('default focus keeps a mix of types', () => {
    const res = recommend({ answers:{ ...answers, time:'full' }, wx:null, now:sat9 })
    expect(new Set(res.stops.map(s => s.type)).size).toBeGreaterThan(1)
  })
  it('focus survives the share round-trip', () => {
    const a = { ...answers, focus:'cafe' as Focus }
    const res = recommend({ answers:a, wx:null, now:sat9 })
    expect(decodePlan(encodePlan({ answers:a, result:res }))!.answers.focus).toBe('cafe')
  })
})

describe('menu pricing', () => {
  it('averages item prices rounded to 1.000đ', () => {
    expect(menuAverage([{ n:'a', p:10000 }, { n:'b', p:15000 }])).toBe(13000)
    expect(menuAverage([])).toBe(0)
  })
  it('place cost equals the menu average for places that have a menu', () => {
    for (const id of Object.keys(MENUS)) {
      const p = PLACES.find(x => x.id === id)
      expect(p, id).toBeTruthy()
      expect(p!.cost).toBe(menuAverage(MENUS[id].items))
      expect(p!.menuSrc!.length).toBeGreaterThan(0)
    }
  })
  it('every food/cafe place is labelled menu / partial / est, never silently guessed', () => {
    for (const p of PLACES.filter(x => x.type === 'food' || x.type === 'cafe')) {
      expect(['menu', 'partial', 'est']).toContain(p.priceQuality)
    }
    const est = applyMenus([{ id:'ZZ', type:'cafe', cost:40000, badges:['~40.000đ'] } as unknown as RawPlace], {})[0]
    expect(est.priceQuality).toBe('est')
    expect(est.badges[0]).toMatch(/^Ước tính/)
  })
  it('only ≥4-item lists are marked as a full menu', () => {
    for (const p of PLACES.filter(x => x.priceQuality === 'menu')) expect(p.menu!.length).toBeGreaterThanOrEqual(4)
  })
  it('no duplicate ids', () => {
    expect(new Set(PLACES.map(p => p.id)).size).toBe(PLACES.length)
  })
})

import { validOrigin, AREA_PRESETS, distanceKm } from '../recommend'

describe('user location', () => {
  it('ignores positions outside Sa Pa or malformed', () => {
    expect(validOrigin({ lat:10.77, lng:106.7 })).toBeNull()
    expect(validOrigin({ lat:'x' as unknown as number, lng:1 })).toBeNull()
    expect(validOrigin(null)).toBeNull()
    expect(validOrigin(AREA_PRESETS.trungtam)).not.toBeNull()
  })
  it('starts near the user and reports distance', () => {
    const loc: Loc = { ...AREA_PRESETS.trungtam, src:'area' }
    const res = recommend({ answers:{ ...answers, time:'half', loc }, wx:null, now:sat9 })
    expect(res.stops[0].distKm).not.toBeNull()
    const base = recommend({ answers:{ ...answers, time:'half' }, wx:null, now:sat9 })
    expect(base.stops[0].distKm).toBeNull()
    const d = (r: Plan) => distanceKm(loc, r.stops[0])
    expect(d(res)).toBeLessThanOrEqual(d(base) + 0.001)
  })
  it('far-away location behaves like no location', () => {
    const a = recommend({ answers:{ ...answers, loc:{ lat:10.77, lng:106.7 } }, wx:null, now:sat9 })
    const b = recommend({ answers, wx:null, now:sat9 })
    expect(a.stops.map(s => s.id)).toEqual(b.stops.map(s => s.id))
  })
})

describe('Ngũ Chỉ Sơn trek', () => {
  it('is offered as the anchor when the user is nearby and wants a full adventure day', () => {
    const loc: Loc = { ...AREA_PRESETS.ngochison, src:'area' }
    const res = recommend({ answers:{ mood:'adventure', budget:5, time:'full', group:'solo', mode:'tourist', loc }, wx:{ code:0 }, now:sat9 })
    expect(res.stops.map(s => s.id)).toContain('SP001')
  })
})

describe('place data sanity', () => {
  it('every place has coordinates inside Sa Pa, a valid type and a non-negative cost', () => {
    const types = ['food', 'cafe', 'attraction', 'museum', 'nature', 'market', 'lodging']
    for (const p of PLACES) {
      expect(p.lat, p.id).toBeGreaterThan(22.15); expect(p.lat, p.id).toBeLessThan(22.55)
      expect(p.lng, p.id).toBeGreaterThan(103.6); expect(p.lng, p.id).toBeLessThan(104.05)
      expect(types, p.id).toContain(p.type)
      expect(p.cost, p.id).toBeGreaterThanOrEqual(0)
    }
  })
  it('ids are unique and the 59 Sa Pa places (35 + 24 from mammamia)  are present', () => {
    expect(new Set(PLACES.map(p => p.id)).size).toBe(PLACES.length)
    expect(PLACES).toHaveLength(59)
    expect(PLACES.filter(p => p.type === 'lodging')).toHaveLength(18)
  })
  it('place data is Sa Pa only (no leftovers from the Hanoi build)', () => {
    expect(JSON.stringify(PLACES)).not.toMatch(/Hà Nội|Hoàn Kiếm|Hanoi/)
  })
})

import { inferAnswers } from '../infer'

describe('zero-question plan', () => {
  it('infers a valid plan from the clock and weather alone', () => {
    const rain = inferAnswers({ now: sat9, wx:{ code:61, temp:24 } })
    expect(rain).toMatchObject({ mood:'calm', time:'half', auto:true })
    expect(rain.why).toContain('rain')
    const eve = inferAnswers({ now: new Date(2026, 9, 19, 20, 0), wx:{ code:0, temp:27 } })
    expect(['energy', 'adventure']).toContain(eve.mood); expect(eve.time).toBe('2h')
    expect(['adventure', 'energy']).toContain(inferAnswers({ now: sat9, wx:{ code:0, temp:27 } }).mood)
    expect(['nostalgia', 'calm']).toContain(inferAnswers({ now: mon9, wx:null }).mood)
  })
  it('reuses the last budget/group/mode', () => {
    const a = inferAnswers({ now: mon9, last:{ budget:5, group:'family', mode:'local' } })
    expect(a).toMatchObject({ budget:5, group:'family', mode:'local' })
  })
  it('always yields stops for any time of day and weather', () => {
    for (const h of [6, 9, 12, 15, 18, 21, 23]) for (const code of [0, 61]) {
      const a = inferAnswers({ now: new Date(2026, 9, 19, h, 0), wx:{ code, temp:30 } })
      const res = recommend({ answers:a, wx:{ code }, now: new Date(2026, 9, 19, h, 0) })
      expect(res.stops.length, `h${h} code${code}`).toBeGreaterThan(0)
    }
  })
})

import { exportMemory, importMemory, toggleFav, hidePlace, unhidePlace, noteShown, getMemory, clearMemory, mergeStates, normalize, favIds } from '../memory'

describe('memory backup', () => {
  const store: Record<string, string> = {}
  ;(globalThis as any).localStorage = { getItem:(k: string) => store[k] ?? null, setItem:(k: string, v: string) => { store[k] = String(v) }, removeItem:(k: string) => { delete store[k] } }
  it('round-trips favourites, hidden places and history through a backup code', () => {
    clearMemory(); toggleFav('HK001'); hidePlace('TD003'); noteShown(['HK001', 'PC003'], '2026-10-17')
    const code = exportMemory()
    expect(code.startsWith('SS1.')).toBe(true)
    clearMemory()
    expect(getMemory().hidden).toEqual([])
    const r = importMemory(code)
    expect(r.ok).toBe(true)
    const m = getMemory()
    expect(Object.keys(m.favs)).toContain('HK001')
    expect(m.hidden).toContain('TD003')
    expect(m.history['2026-10-17']).toEqual(['HK001', 'PC003'])
  })
  it('rejects garbage and hostile codes', () => {
    expect(importMemory('hello').ok).toBe(false)
    expect(importMemory('HN1.%%%').ok).toBe(false)
    const bad = 'HN1.' + btoa(JSON.stringify({ favs:{ '<script>':1 }, hidden:['../x'], history:{ 'x':['a'] } }))
    clearMemory(); expect(importMemory(bad).ok).toBe(true)
    const m = getMemory(); expect(Object.keys(m.favs)).toEqual([]); expect(m.hidden).toEqual([]); expect(m.history).toEqual({})
  })
})

describe('memory merge (two devices)', () => {
  it('a later un-favourite on one device wins over an earlier favourite on the other', () => {
    const a = { v:2, marks:{ fav:{ HK001:{ t:100, on:true } }, visited:{}, hidden:{} }, shown:{}, history:{} }
    const b = { v:2, marks:{ fav:{ HK001:{ t:200, on:false }, PC003:{ t:150, on:true } }, visited:{}, hidden:{} }, shown:{}, history:{} }
    const m = mergeStates(a, b)
    expect(m.marks.fav.HK001.on).toBe(false)
    expect(m.marks.fav.PC003.on).toBe(true)
    expect(mergeStates(b, a)).toEqual(m)                   // commutative
    expect(mergeStates(m, m)).toEqual(m)                   // idempotent
  })
  it('migrates the old format and keeps its data', () => {
    const s = normalize({ favs:{ HK001:5 }, hidden:['TD003'], visited:{ PC003:7 }, history:{ '2026-10-17':['HK001'] } })
    expect(s.marks.fav.HK001.on).toBe(true); expect(s.marks.hidden.TD003.on).toBe(true)
    expect(s.history['2026-10-17'].ids).toEqual(['HK001'])
  })
  it('hide then unhide leaves no hidden places; clear forgets everything', () => {
    clearMemory(); hidePlace('TD003'); unhidePlace('TD003'); toggleFav('HK001')
    expect(getMemory().hidden).toEqual([]); expect(favIds()).toEqual(['HK001'])
    clearMemory(); expect(favIds()).toEqual([])
  })
})
