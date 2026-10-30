/**
 * Compare every place in src/data/places.ts with a real geocoder and print the ones that disagree.
 *
 *   GOOGLE_MAPS_KEY=AIza... npm run verify:places        (Google Geocoding API — best match with Google Maps)
 *   npm run verify:places                                 (no key: OpenStreetMap Nominatim, 1 request/second)
 *
 * Options: THRESHOLD=150 (metres), OUT=places-report.csv
 * Needs internet access, so run it on your own machine (the Claude sandbox cannot reach these services).
 */
import { writeFileSync } from 'node:fs'
import { PLACES } from '../src/data/places'

const KEY = process.env.GOOGLE_MAPS_KEY
const THRESHOLD = Number(process.env.THRESHOLD) || 150
const OUT = process.env.OUT || 'places-report.csv'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lat - b.lat) * 111_000, (a.lng - b.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180))

/** Strip the parts of our names that a geocoder would not know ("& Tháp Rùa", "(Obama)"…). */
const query = (name: string) => name.replace(/\(.*?\)/g, '').replace(/&.*/, '').trim() + ', Sa Pa, Lào Cai, Việt Nam'

async function geocode(q: string): Promise<{ lat: number; lng: number; label: string } | null> {
  if (KEY) {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=vn&language=vi&bounds=22.15,103.6|22.55,104.05&key=${KEY}`)
    const j = await r.json() as { status: string; results: { geometry: { location: { lat: number; lng: number } }; formatted_address: string }[] }
    if (j.status !== 'OK' || !j.results[0]) return null
    const { lat, lng } = j.results[0].geometry.location
    return { lat, lng, label: j.results[0].formatted_address }
  }
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&viewbox=103.6,22.55,104.05,22.15&bounded=1&q=${encodeURIComponent(q)}`, { headers: { 'User-Agent': 'sapasense-verify/1.0' } })
  const j = await r.json() as { lat: string; lon: string; display_name: string }[]
  return j[0] ? { lat: +j[0].lat, lng: +j[0].lon, label: j[0].display_name } : null
}

const rows = ['id,name,our_lat,our_lng,found_lat,found_lng,distance_m,status,found_label']
let bad = 0
for (const p of PLACES) {
  let status = 'ok', f: Awaited<ReturnType<typeof geocode>> = null
  try { f = await geocode(query(p.name)) } catch { status = 'error' }
  const d = f ? Math.round(metres(p, f)) : -1
  if (!f && status !== 'error') status = 'not found'
  else if (f && d > 3000) status = 'WRONG MATCH'   // geocoder picked another place with a similar name — ignore
  else if (f && d > THRESHOLD) status = 'CHECK'
  if (status !== 'ok') bad++
  console.log(`${status.padEnd(9)} ${p.id.padEnd(6)} ${p.name}${f ? `  (${d} m)` : ''}`)
  rows.push([p.id, `"${p.name}"`, p.lat, p.lng, f?.lat ?? '', f?.lng ?? '', d, status, `"${(f?.label ?? '').replace(/"/g, '')}"`].join(','))
  await sleep(KEY ? 100 : 1100)
}
writeFileSync(OUT, rows.join('\n'))
console.log(`\n${PLACES.length - bad}/${PLACES.length} match within ${THRESHOLD} m. Report: ${OUT}`)
console.log('A geocoder can pick a different branch of a chain — open every CHECK row on the map before changing coordinates.')
