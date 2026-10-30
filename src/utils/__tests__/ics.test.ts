import { it, expect } from 'vitest'
import { planToICS } from '../ics'
it('builds an iCalendar with one UTC event per stop (Vietnam = UTC+7)', () => {
  const ics = planToICS({ dateISO:'2026-10-29', stops:[{ id:'SP002', name:'VQG Hoàng Liên; Fansipan', time:'08:00 - 12:15', area:'Hoàng Liên', lat:22.3, lng:103.7, tip:'Đi sớm, mang áo ấm' }] as never }, new Date(Date.UTC(2026, 9, 29, 0, 0)))
  expect(ics).toContain('BEGIN:VCALENDAR'); expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
  expect(ics).toContain('DTSTART:20261029T010000Z'); expect(ics).toContain('DTEND:20261029T051500Z')
  expect(ics).toContain('SUMMARY:VQG Hoàng Liên\; Fansipan'); expect(ics).toContain('\r\n')
})
