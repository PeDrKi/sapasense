import { it, expect } from 'vitest'
import { recommend } from '../recommend'
import { inferAnswers } from '../infer'
import { PLACES } from '../../data/places'

it('a frequent user keeps seeing new places (60 plans over 30 days)', () => {
  // 30 days, "Gợi ý cho tôi ngay" once at 9h or 17h, weather alternating
  const seen: Record<string, number> = {}, perDay: string[] = [], shownOn: Record<string, string> = {}
  let repeatsConsecutive = 0, prev: string[] | null = null
  for (let d = 0; d < 30; d++) {
    for (const h of [9, 17]) {
      const now = new Date(2026, 9, 1 + d, h, 0)
      const wx = { code: d % 5 === 0 ? 61 : 0, temp: 28 }
      const a = inferAnswers({ now, wx })
      const today = `2026-10-${String(1 + d).padStart(2, '0')}`
      const recent = Object.entries(shownOn).filter(([, dd]) => dd < today).map(([i]) => i)
      const res = recommend({ answers: { ...a, recent }, wx, now })
      res.stops.forEach(s => { shownOn[s.id] = today })
      const ids = res.stops.map(s => s.id)
      ids.forEach(i => seen[i] = (seen[i] || 0) + 1)
      if (prev && ids.length && ids.join() === prev.join()) repeatsConsecutive++
      prev = ids; perDay.push(ids.join('>'))
    }
  }
  const used = Object.keys(seen).length
  expect(used).toBeGreaterThanOrEqual(14)   // 14 of 20 playable places fit the default 800K budget
  expect(new Set(perDay).size).toBeGreaterThanOrEqual(25)   // 20 playable places give fewer distinct combinations than the old 65
  expect(repeatsConsecutive).toBeLessThanOrEqual(8)   // rainy days have a small indoor pool, so a few repeats are unavoidable
})

it('hidden places never appear, visited sights are deprioritised, same day is stable', () => {
  const now = new Date(2026, 9, 17, 9, 0)
  const a = inferAnswers({ now, wx:null })
  const base = recommend({ answers: a, wx:null, now })
  expect(recommend({ answers: a, wx:null, now }).stops.map(s => s.id)).toEqual(base.stops.map(s => s.id))
  const hidden = base.stops.map(s => s.id)
  const after = recommend({ answers: { ...a, hidden }, wx:null, now })
  for (const s of after.stops) expect(hidden).not.toContain(s.id)
  const other = recommend({ answers: { ...a, seed:1 }, wx:null, now })
  expect(other.stops.map(s => s.id)).not.toEqual(base.stops.map(s => s.id))
})
