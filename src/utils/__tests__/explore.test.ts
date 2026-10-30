import { describe, it, expect } from 'vitest'
import { openState, parseHours } from '../openNow'
import { safetyAdvice } from '../safety'
import { PLACES } from '../../data/places'

describe('opening hours', () => {
  it('parses ranges and 24/24', () => {
    expect(parseHours('07:30–16:30')).toEqual([7.5, 16.5])
    expect(parseHours('24/24')).toBe('always')
    expect(parseHours('')).toBeNull()
  })
  it('open / closed by the clock', () => {
    expect(openState('07:00–17:00', new Date(2026, 9, 29, 9, 0))).toBe('open')
    expect(openState('07:00–17:00', new Date(2026, 9, 29, 18, 0))).toBe('closed')
    expect(openState('24/24', new Date(2026, 9, 29, 3, 0))).toBe('always')
    expect(openState(undefined)).toBeNull()
  })
  it('every Sa Pa place carries hours and an address from the spreadsheet', () => {
    for (const p of PLACES) { expect(p.hours, p.id).toBeTruthy(); expect(p.address, p.id).toBeTruthy() }
  })
})

describe('weather safety advice', () => {
  it('warns for thunder, rain, fog and cold, and stays quiet otherwise', () => {
    expect(safetyAdvice({ code:95, temp:15 })?.level).toBe('danger')
    expect(safetyAdvice({ code:63, temp:15 })?.level).toBe('warn')
    expect(safetyAdvice({ code:45, temp:15 })?.icon).toBe('🌫')
    expect(safetyAdvice({ code:0, temp:6 })?.level).toBe('warn')
    expect(safetyAdvice({ code:0, temp:12 })?.level).toBe('info')
    expect(safetyAdvice({ code:0, temp:22 })).toBeNull()
    expect(safetyAdvice(null)).toBeNull()
  })
})
