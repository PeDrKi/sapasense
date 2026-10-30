import { it, expect } from 'vitest'
import { recommend } from '../recommend'
import { inferAnswers } from '../infer'
import { PLACES } from '../../data/places'

it('zero-question path covers the catalogue evenly over 60 days', () => {
  const seen: Record<string, number> = {}, shownOn: Record<string, string> = {}
  let plans = 0
  for (let d = 0; d < 60; d++) for (const h of [8, 12, 16, 19]) for (const code of [0, 61]) {
    const now = new Date(2026, 9, 1 + d, h, 0)
    const wx = { code, temp: 28 }
    const a = inferAnswers({ now, wx })
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const recent = Object.entries(shownOn).filter(([, dd]) => dd < today).map(([i]) => i)
    const res = recommend({ answers: { ...a, recent }, wx, now })
    res.stops.forEach(s => { seen[s.id] = (seen[s.id] || 0) + 1; shownOn[s.id] = today }); plans++
  }
  const total = Object.values(seen).reduce((x, y) => x + y, 0)
  const top = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([i, n]) => `${i}:${(100*n/total).toFixed(1)}%`)
  expect(Object.keys(seen).length).toBeGreaterThanOrEqual(14)   // 14 of 20 playable places fit the default 800K budget (fine dining and the 1.5M trek do not)
  expect(Math.max(...Object.values(seen)) / total).toBeLessThan(0.2)
  void [Object.keys(seen).length, PLACES.length, top.join(' '), PLACES.filter(p => !seen[p.id]).map(p => p.id).join(' ')]
})
