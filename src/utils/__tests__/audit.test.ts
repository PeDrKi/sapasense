import { it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { recommend } from '../recommend'
import { PLACES } from '../../data/places'

const TYPES = ['attraction','food','cafe','museum','nature','market','lodging']
const MOODS = ['calm','adventure','nostalgia','energy']
const GROUPS = ['solo','couple','friends','family']
const TOD = ['morning','afternoon','evening','any']

it('data audit: valid enums, bounds, unique ids, photo files exist', () => {
  const ids = new Set<string>()
  for (const p of PLACES) {
    expect(ids.has(p.id), 'dup ' + p.id).toBe(false); ids.add(p.id)
    expect(TYPES, p.id).toContain(p.type)
    expect(p.moods.length, p.id).toBeGreaterThan(0)
    for (const m of p.moods) expect(MOODS, p.id + ' mood ' + m).toContain(m)
    expect(p.groups.length, p.id).toBeGreaterThan(0)
    for (const g of p.groups) expect(GROUPS, p.id + ' group ' + g).toContain(g)
    for (const t of p.timeOfDay) expect(TOD, p.id + ' tod ' + t).toContain(t)
    expect(p.lat, p.id).toBeGreaterThan(22.1); expect(p.lat, p.id).toBeLessThan(22.5)
    expect(p.lng, p.id).toBeGreaterThan(103.6); expect(p.lng, p.id).toBeLessThan(104.1)
    expect(p.duration, p.id).toBeGreaterThan(0); expect(p.duration, p.id).toBeLessThanOrEqual(1440)
    expect(p.cost, p.id).toBeGreaterThanOrEqual(0)
    expect(p.desc.length, p.id).toBeGreaterThan(20)
    if (p.img) expect(fs.existsSync(path.join(__dirname, '../../../public', p.img)), p.id + ' missing ' + p.img).toBe(true)
  }
})

it('fuzz: every answer combination yields a valid plan', () => {
  const nows = [new Date(2026, 9, 29, 7, 0), new Date(2026, 9, 29, 11, 0), new Date(2026, 9, 29, 16, 30), new Date(2026, 9, 29, 21, 30)]
  const wxs = [null, { code: 0, temp: 22 }, { code: 61, temp: 14 }, { code: 95, temp: 15 }]
  const empty: string[] = []
  let n = 0
  for (const mode of ['tourist','local'] as const)
  for (const focus of ['all','food','cafe'] as const)
  for (const time of ['2h','half','full'] as const)
  for (const mood of MOODS as any[])
  for (const group of GROUPS as any[])
  for (const budget of [0, 2, 4])
  for (const now of nows) {
    const wx = wxs[n % wxs.length] as any
    const res = recommend({ answers: { mood, budget, time, group, mode, focus } as any, wx, now })
    const ids = res.stops.map(s => s.id)
    expect(new Set(ids).size, JSON.stringify({ mode, focus, time, mood, group, budget })).toBe(ids.length)
    for (const s of res.stops) {
      const p = PLACES.find(x => x.id === s.id)!
      expect(p, s.id).toBeTruthy(); expect(p.type, s.id).not.toBe('lodging')
      if (focus === 'food') expect(['food','market','cafe']).toContain(p.type)
      if (focus === 'cafe') expect(p.type).toBe('cafe')
    }
    n++
  }
  expect(n).toBeGreaterThan(1000)
})

it('old HN backup codes still restore; new codes use SS1 prefix', async () => {
  const { exportMemory, importMemory } = await import('../memory')
  const code = exportMemory()
  expect(code.startsWith('SS1.')).toBe(true)
  expect(importMemory(code).ok).toBe(true)
  expect(importMemory('HN2.' + code.slice(4)).ok).toBe(true)
  expect(importMemory('XX1.' + code.slice(4)).ok).toBe(false)
})

it('share link keeps total budget and people', async () => {
  const { encodePlan, decodePlan } = await import('../share')
  const now = new Date(2026, 9, 29, 9, 0)
  const { inferAnswers } = await import('../infer')
  const answers = { ...inferAnswers({ now, wx: null }), budget: 7_654_321, people: 6, time: 'full' } as any
  const result = recommend({ answers, wx: null, now })
  const back = decodePlan(encodePlan({ answers, result }))
  expect(back?.answers.budget).toBe(7_654_321)
  expect(back?.answers.people).toBe(6)
})
