import { it, expect } from 'vitest'
import { recommend } from '../recommend'
import { PLACES } from '../../data/places'
import type { Mood, GroupAnswer, TimeId } from '../../types'

it('every place can be reached by some combination of answers', () => {
  const reach: Record<string, number> = {}
  const moods: Mood[] = ['calm', 'energy', 'nostalgia', 'adventure']
  const groups: GroupAnswer[] = ['solo', 'couple', 'friends', 'family']
  for (const mood of moods) for (const group of groups) for (const time of ['2h', 'half', 'full'] as TimeId[])
    for (const [y, m, d, h] of [[2026, 9, 19, 9], [2026, 9, 19, 14], [2026, 9, 19, 19], [2026, 9, 17, 19], [2026, 9, 18, 10]])
      for (const budget of [2, 3, 5]) for (const seed of [0, 1, 2]) {
        const now = new Date(y, m, d, h, 0)
        for (const wx of [{ code:0 }, { code:61 }]) {
          const res = recommend({ answers:{ mood, group, time, budget, mode:'tourist', focus:'all', seed }, wx, now })
          res.stops.forEach(s => { reach[s.id] = (reach[s.id] || 0) + 1 })
        }
      }
  const playable = PLACES.filter(p => p.type !== 'lodging')   // hotels are never scheduled
  // SP001 (12-hour Ngũ Chỉ Sơn trek, 1.5M) only becomes a day's anchor when the user is nearby: see recommend.test.ts
  const never = playable.filter(p => !reach[p.id] && p.id !== 'SP001')
  const total = Object.values(reach).reduce((a, b) => a + b, 0)
  const top = Object.entries(reach).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([i, n]) => `${i}:${(100 * n / total).toFixed(1)}%`)
  expect(never.map(p => p.id)).toEqual([])
  expect(Math.max(...Object.values(reach)) / total).toBeLessThan(0.2)   // 20 playable places instead of 65
  void never.map(p => `${p.id}(${p.type},${p.timeOfDay},${p.cost})`).join(' ')
  console.log('TOP SHARE:', top.join(' '), '| reached', Object.keys(reach).length, '/', PLACES.length)
})
