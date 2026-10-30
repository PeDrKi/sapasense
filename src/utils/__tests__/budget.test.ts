import { it, expect } from 'vitest'
import { budgetPerPerson, clampPeople, normalizeBudget, isValidBudget, formatVnd, parseBudgetInput, sliderToBudget, budgetToSlider, BUDGET_MIN, BUDGET_MAX } from '../budget'
import { getBudgetAmount, recommend } from '../recommend'
import { inferAnswers } from '../infer'

it('legacy level indexes still map to the old amounts; real VND passes through', () => {
  expect([1, 2, 3, 4, 5].map(normalizeBudget)).toEqual([200000, 500000, 800000, 1500000, 3000000])
  expect(normalizeBudget(1234567)).toBe(1234567)
  expect(normalizeBudget(25_000_000)).toBe(25_000_000)
  expect(getBudgetAmount(4)).toBe(1500000)
  expect(getBudgetAmount(7_500_000)).toBe(7_500_000)
})
it('clamps and validates', () => {
  expect(normalizeBudget(10)).toBe(BUDGET_MIN)
  expect(normalizeBudget(9e12)).toBe(BUDGET_MAX)
  expect(normalizeBudget('abc')).toBe(800000)
  expect(isValidBudget(3)).toBe(true); expect(isValidBudget(1250000)).toBe(true)
  expect(isValidBudget(0)).toBe(false); expect(isValidBudget(1000)).toBe(false); expect(isValidBudget(1.5)).toBe(false); expect(isValidBudget('5')).toBe(false)
})
it('parses free-form amounts', () => {
  const cases: [string, number | null][] = [['1.250.000', 1250000], ['1,250,000', 1250000], ['800k', 800000], ['1,5tr', 1500000], ['2 triệu', 2000000], ['3m', 3000000], ['1234567đ', 1234567], ['', null], ['abc', null]]
  for (const [s, v] of cases) expect(parseBudgetInput(s), s).toBe(v)
})
it('formats per language', () => {
  expect(formatVnd(1250000, 'EN')).toBe('1,250,000đ')
  expect(formatVnd(3, 'EN')).toBe('800,000đ')
  expect(formatVnd(1250000, 'VI').replace(/\D/g, '')).toBe('1250000')
})
it('log slider round-trips and is monotonic', () => {
  let prev = 0
  for (let p = 0; p <= 1000; p += 25) { const v = sliderToBudget(p); expect(v).toBeGreaterThanOrEqual(prev); prev = v }
  expect(sliderToBudget(0)).toBe(BUDGET_MIN); expect(sliderToBudget(1000)).toBe(BUDGET_MAX)
  for (const v of [200000, 800000, 3000000, 20000000]) expect(Math.abs(sliderToBudget(budgetToSlider(v)) - v) / v).toBeLessThan(0.05)
})
it('plans work for odd and very large budgets, and a bigger budget unlocks pricier stops', () => {
  const now = new Date(2026, 9, 29, 9, 0)
  const base = inferAnswers({ now, wx: null })
  for (const budget of [BUDGET_MIN, 123457, 987654, 12_345_678, BUDGET_MAX]) {
    const res = recommend({ answers: { ...base, budget, time: 'full' } as any, wx: null, now })
    expect(res.stops.length, String(budget)).toBeGreaterThan(0)
  }
  const small = recommend({ answers: { ...base, budget: 100000, time: 'full', mood: 'adventure' } as any, wx: null, now })
  const big   = recommend({ answers: { ...base, budget: 20_000_000, time: 'full', mood: 'adventure' } as any, wx: null, now })
  expect(Math.max(...big.stops.map(s => s.cost))).toBeGreaterThanOrEqual(Math.max(...small.stops.map(s => s.cost)))
})

it('total budget is split by number of people', () => {
  expect(budgetPerPerson(4_000_000, 4)).toBe(1_000_000)
  expect(budgetPerPerson(4_000_000)).toBe(4_000_000)
  expect(budgetPerPerson(4_000_000, 0)).toBe(4_000_000)
  expect(budgetPerPerson(100_000, 10)).toBe(BUDGET_MIN)      // never below the minimum
  expect(budgetPerPerson(3, 1)).toBe(800_000)                  // legacy level index
  expect(clampPeople(-3)).toBe(1); expect(clampPeople(500)).toBe(100); expect(clampPeople('x')).toBe(1)
})
it('a group gets cheaper-per-head picks than a solo traveller with the same total', () => {
  const now = new Date(2026, 9, 29, 9, 0)
  const base = inferAnswers({ now, wx: null })
  const cost = (people: number) => {
    const r = recommend({ answers: { ...base, budget: 2_000_000, people, time: 'full', mood: 'adventure' } as any, wx: null, now })
    return Math.max(...r.stops.map(s => s.cost))
  }
  expect(cost(10)).toBeLessThanOrEqual(cost(1))
})
