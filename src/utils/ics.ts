import type { Plan } from '../types'

const pad = (n: number) => String(n).padStart(2, '0')
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
/** Local Vietnam time (UTC+7, no DST) → UTC stamp yyyymmddThhmmssZ. */
function utc(dateISO: string, hhmm: string): string {
  const [y, mo, d] = dateISO.split('-').map(Number); const [h, mi] = hhmm.split(':').map(Number)
  const t = new Date(Date.UTC(y, mo - 1, d, h - 7, mi, 0))
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00Z`
}

/** iCalendar (.ics) of a plan: one event per stop, with place, tip and a Google Maps link. */
export function planToICS(plan: Pick<Plan, 'dateISO' | 'stops'>, now: Date = new Date()): string {
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`
  const ev = plan.stops.map(s => {
    const [a, b] = s.time.split(' - ')
    return ['BEGIN:VEVENT', `UID:${s.id}-${plan.dateISO}@sapasense`, `DTSTAMP:${stamp}`,
      `DTSTART:${utc(plan.dateISO, a)}`, `DTEND:${utc(plan.dateISO, b || a)}`,
      `SUMMARY:${esc(s.name)}`, `LOCATION:${esc(s.name + (s.area ? ', ' + s.area : '') + ', Sa Pa')}`,
      `GEO:${s.lat};${s.lng}`,
      `DESCRIPTION:${esc((s.tip ? s.tip + '\n' : '') + `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`)}`,
      'END:VEVENT'].join('\r\n')
  })
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SapaSense//VI', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:SapaSense', ...ev, 'END:VCALENDAR'].join('\r\n') + '\r\n'
}

export function downloadICS(plan: Pick<Plan, 'dateISO' | 'stops'>) {
  const blob = new Blob([planToICS(plan)], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sapasense-${plan.dateISO}.ics`
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
