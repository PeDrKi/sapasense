import { it, expect } from 'vitest'
import { reverseGeocode } from '../geocode'
const ok = (body: unknown) => (async () => ({ ok:true, json: async () => body })) as unknown as typeof fetch
it('turns coordinates into a short and a full address, and caches', async () => {
  let calls = 0
  const f = (async () => { calls++; return { ok:true, json: async () => ({ display_name:'Cầu Mây, Sa Pa, Lào Cai, Việt Nam', address:{ road:'Cầu Mây', town:'Sa Pa', state:'Lào Cai' } }) } }) as unknown as typeof fetch
  const a = await reverseGeocode(22.3364, 103.8438, 'vi', f)
  expect(a?.short).toBe('Cầu Mây, Sa Pa, Lào Cai'); expect(a?.text).toContain('Việt Nam')
  await reverseGeocode(22.3364, 103.8438, 'vi', f); expect(calls).toBe(1)
})
it('returns null for bad input, HTTP errors, empty answers and network failures', async () => {
  expect(await reverseGeocode(NaN, 1, 'vi', ok({}))).toBeNull()
  expect(await reverseGeocode(22.1, 103.1, 'vi', (async () => ({ ok:false })) as unknown as typeof fetch)).toBeNull()
  expect(await reverseGeocode(22.2, 103.2, 'vi', ok({}))).toBeNull()
  expect(await reverseGeocode(22.3, 103.3, 'vi', (async () => { throw new Error('offline') }) as unknown as typeof fetch)).toBeNull()
})
