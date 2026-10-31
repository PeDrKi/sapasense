import { describe, it, expect } from 'vitest'
import { wxLevel, weatherDelta, fitsWeather, isCold } from '../weatherRules'
import { estimateTemp } from '../../data/altitude'
import { recommend } from '../recommend'
import { getPlaces } from '../../data/placeStore'
import { isStrenuous } from '../../data/fitness'
import { encodePlan, decodePlan } from '../share'
import type { Answers } from '../../types'

const base: Answers = { mood:'calm', budget:3_000_000, time:'full', group:'friends', mode:'tourist', focus:'all', startHour:9, dayOffset:1 } as Answers
const noon = new Date('2026-11-04T09:00:00')

describe('weather thresholds', () => {
  it('classifies per report', () => {
    expect(wxLevel({ code:1, precip:0 })).toBe('ok')
    expect(wxLevel({ code:61, precip:1 })).toBe('rain')
    expect(wxLevel({ code:3, precip:6 })).toBe('severe')
    expect(wxLevel({ code:3, visibility:300 })).toBe('severe')
    expect(wxLevel({ code:95 })).toBe('severe')
    expect(isCold({ temp:3 })).toBe(true)
    expect(isCold({ temp:'--' })).toBe(false)
  })
  it('delta: +15 outdoor in nice weather, +20 warm indoor in rain', () => {
    expect(weatherDelta({ indoor:false, type:'nature' }, { code:0, temp:20 })).toBe(15)
    expect(weatherDelta({ indoor:true, type:'cafe' }, { code:61 })).toBe(20)
    expect(weatherDelta({ indoor:false, type:'nature' }, { code:61 })).toBe(0)
  })
  it('severe weather yields only indoor stops', () => {
    const out = recommend({ answers: base, wx: { code:3, precip:8, visibility:200, temp:10 }, now: noon })
    const all = getPlaces()
    expect(out.stops.length).toBeGreaterThan(0)
    for (const s of out.stops) expect(all.find(p => p.id === s.id)!.indoor).toBe(true)
    for (const s of out.stops) expect(fitsWeather(all.find(p => p.id === s.id)!, { code:3, precip:8 })).toBe(true)
  })
})
describe('altitude', () => {
  it('cools 0.6°C per 100 m', () => {
    expect(estimateTemp('Núi Ngũ Chỉ Sơn', 15)).toBe(12.6)
    expect(estimateTemp('Bản Hồ', 15)).toBe(18.6)
    expect(estimateTemp('??', 15)).toBeNull()
  })
})
describe('fitness', () => {
  it('limited fitness drops strenuous places', () => {
    for (let seed = 0; seed < 10; seed++) {
      const out = recommend({ answers: { ...base, fitness:'limited', seed }, wx: { code:0, temp:20 }, now: noon })
      for (const s of out.stops) expect(isStrenuous(s.id)).toBe(false)
    }
  })
  it('survives share link round-trip', () => {
    const a = { ...base, fitness:'limited' } as Answers
    const out = recommend({ answers: a, wx: null, now: noon })
    const dec = decodePlan(encodePlan({ answers: a, result: out }))
    expect(dec?.answers.fitness).toBe('limited')
  })
})

import { packingAdvice } from '../packing'
import { parseForecast } from '../forecast'
import { allergyHits } from '../../data/health'
import { MOTION_KM, AREA_PRESETS, distanceKm } from '../recommend'

describe('packing advice', () => {
  it('cold + rainy day → warm layers and umbrella/poncho', () => {
    const a = packingAdvice({ tMax:11, tMin:4, rainProb:80, rainMm:6, code:63, uv:1, wind:10 })
    expect(a.outfit).toMatch(/lạnh/i)
    expect(a.items.join(' ')).toMatch(/áo mưa|ô/)
  })
  it('hot UV day → sunscreen', () => {
    expect(packingAdvice({ tMax:27, tMin:18, rainProb:5, rainMm:0, code:0, uv:8, wind:5 }).items.join(' ')).toMatch(/chống nắng/)
  })
  it('parses open-meteo daily', () => {
    const d = parseForecast({ daily:{ time:['2026-11-01'], weather_code:[3], temperature_2m_max:[18.4], temperature_2m_min:[11.2], precipitation_probability_max:[40], precipitation_sum:[0.5], uv_index_max:[5], wind_speed_10m_max:[12] } })
    expect(d[0]).toMatchObject({ tMax:18, tMin:11, rainProb:40 })
  })
})
describe('health personalization', () => {
  it('detects seafood in a salmon restaurant', () => {
    expect(allergyHits({ name:'Nhà hàng Cá hồi Song Nhi', desc:'' }, ['seafood'])).toEqual(['seafood'])
    expect(allergyHits({ name:'Cafe', desc:'Cà phê đen' }, ['seafood'])).toEqual([])
  })
  it('motion sickness keeps every stop near the centre', () => {
    for (let seed = 0; seed < 8; seed++) {
      const out = recommend({ answers: { ...base, motionSick:true, seed }, wx:{ code:0, temp:20 }, now: noon })
      for (const s of out.stops) expect(distanceKm(s, AREA_PRESETS.trungtam)).toBeLessThanOrEqual(MOTION_KM)
    }
  })
})
