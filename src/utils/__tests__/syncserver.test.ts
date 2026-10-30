import { describe, it, expect, beforeEach } from 'vitest'
import { handle, cleanReview, validPlace, parseAdmins, type Admin } from '../../../sync-server/handler'
import { d1Api, type Api } from '../../../sync-server/db'
import { sqliteD1 } from '../../../sync-server/sqlite-shim'
import { PLACES } from '../../data/places'

const ID = 'a'.repeat(64)
const TOKEN = 'secret-token'
const VIEWER = 'viewer-token-1'
const ADMINS: Admin[] = [{ name: 'chu', token: TOKEN, role: 'editor' }, { name: 'ban', token: VIEWER, role: 'viewer' }]
let api: Api
beforeEach(() => { api = d1Api(sqliteD1()) })
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, admins: Admin[] = ADMINS, ip = '') =>
  handle(new Request('http://x' + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), api, { admins, ip })
const asAdmin = { authorization: 'Bearer ' + TOKEN }
const asViewer = { authorization: 'Bearer ' + VIEWER }
const review = { date: 'd', mood: 'calm', ratings: { overall: 5, relevance: 4, accuracy: 3, usability: 2 }, comment: 'ok', stops: ['A', 'B'] }

describe('sync (personal, encrypted)', () => {
  it('starts empty, accepts a first write, then needs the latest rev', async () => {
    let r = await call('GET', '/v1/' + ID); expect(await r.json()).toEqual({ rev: 0, data: null })
    r = await call('PUT', '/v1/' + ID, { rev: 0, data: 'abc' }); expect(r.status).toBe(200); expect((await r.json()).rev).toBe(1)
    r = await call('PUT', '/v1/' + ID, { rev: 0, data: 'zzz' })          // stale writer
    expect(r.status).toBe(409); expect(await r.json()).toEqual({ rev: 1, data: 'abc' })
    r = await call('PUT', '/v1/' + ID, { rev: 1, data: 'def' }); expect((await r.json()).rev).toBe(2)
    r = await call('GET', '/v1/' + ID); expect(await r.json()).toEqual({ rev: 2, data: 'def' })
  })
  it('two writers racing on the same rev: exactly one wins (atomic compare-and-set)', async () => {
    await call('PUT', '/v1/' + ID, { rev: 0, data: 'v1' })
    const [a, b] = await Promise.all([call('PUT', '/v1/' + ID, { rev: 1, data: 'fromA' }), call('PUT', '/v1/' + ID, { rev: 1, data: 'fromB' })])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    expect((await (await call('GET', '/v1/' + ID)).json()).rev).toBe(2)
  })
  it('rejects bad ids, bodies and sizes; answers CORS preflight', async () => {
    expect((await call('GET', '/v1/short')).status).toBe(400)
    expect((await call('PUT', '/v1/' + ID, { rev: 'x', data: 'a' })).status).toBe(400)
    expect((await call('PUT', '/v1/' + ID, { rev: 0, data: '<script>' })).status).toBe(400)
    expect((await call('PUT', '/v1/' + ID, { rev: 0, data: 'a'.repeat(60001) })).status).toBe(400)
    expect((await call('PUT', '/v1/' + ID, { rev: 0, data: 'a'.repeat(70000) })).status).toBe(413)
    const o = await call('OPTIONS', '/v1/' + ID)
    expect(o.status).toBe(204); expect(o.headers.get('access-control-allow-origin')).toBe('*')
    expect((await call('DELETE', '/v1/' + ID)).status).toBe(405)
  })
})

describe('places', () => {
  it('is public to read, admin-only to write, and the list round-trips', async () => {
    expect(await (await call('GET', '/v1/places')).json()).toEqual({ places: [] })
    expect((await call('PUT', '/v1/admin/places', { places: PLACES })).status).toBe(401)
    expect((await call('PUT', '/v1/admin/places', { places: PLACES }, { authorization: 'Bearer wrong' })).status).toBe(401)
    const w = await call('PUT', '/v1/admin/places', { places: PLACES }, asAdmin)
    expect(w.status).toBe(200); expect((await w.json()).count).toBe(PLACES.length)
    const got = (await (await call('GET', '/v1/places')).json()).places
    expect(got).toEqual(JSON.parse(JSON.stringify(PLACES)))           // same content, same order
  })
  it('replaces the whole list and rejects invalid / duplicate places without touching the stored list', async () => {
    await call('PUT', '/v1/admin/places', { places: PLACES.slice(0, 3) }, asAdmin)
    expect((await call('PUT', '/v1/admin/places', { places: [...PLACES.slice(0, 2), { id: 'X', name: '' }] }, asAdmin)).status).toBe(400)
    expect((await call('PUT', '/v1/admin/places', { places: [PLACES[0], PLACES[0]] }, asAdmin)).status).toBe(400)
    expect((await call('PUT', '/v1/admin/places', { places: [] }, asAdmin)).status).toBe(400)
    expect((await (await call('GET', '/v1/places')).json()).places).toHaveLength(3)
    await call('PUT', '/v1/admin/places', { places: PLACES.slice(0, 1) }, asAdmin)
    expect((await (await call('GET', '/v1/places')).json()).places).toHaveLength(1)
  })
  it('admin is disabled when no token is configured', async () => {
    expect((await call('PUT', '/v1/admin/places', { places: PLACES }, asAdmin, [])).status).toBe(503)
  })
  it('validPlace accepts every built-in place', () => { for (const p of PLACES) expect(validPlace(p)).toBe(true) })
})

describe('reviews', () => {
  it('anyone can post a valid review; only the admin can read them', async () => {
    expect((await call('POST', '/v1/reviews', review)).status).toBe(201)
    expect((await call('GET', '/v1/admin/reviews')).status).toBe(401)
    const list = (await (await call('GET', '/v1/admin/reviews?limit=10', undefined, asAdmin)).json()).reviews
    expect(list).toHaveLength(1); expect(list[0]).toMatchObject({ mood: 'calm', comment: 'ok', ratings: { overall: 5 } })
  })
  it('cleans and limits input; rejects non-reviews', async () => {
    expect(cleanReview({ ratings: { overall: 0 } })).toBeNull()
    expect(cleanReview('x')).toBeNull()
    const c = cleanReview({ ...review, ratings: { overall: 99, relevance: -3, accuracy: 'x' }, comment: 'a'.repeat(5000), evil: '<script>' })!
    expect(c.ratings).toEqual({ overall: 5, relevance: 0, accuracy: 0, usability: 0 })
    expect((c.comment as string).length).toBe(1000); expect('evil' in c).toBe(false)
    expect((await call('POST', '/v1/reviews', { ratings: {} })).status).toBe(400)
    expect((await call('POST', '/v1/reviews', 'nope')).status).toBe(400)
    const big = await handle(new Request('http://x/v1/reviews', { method: 'POST', headers: { 'content-length': '999999' }, body: '{}' }), api, { admins: ADMINS })
    expect(big.status).toBe(413)
  })
})

describe('admin: roles, stats, deleting reviews, audit log', () => {
  it('parseAdmins reads name:token:role, ignores weak/invalid entries, keeps the legacy single token', () => {
    expect(parseAdmins('chu:abcdefgh:editor, ban:12345678:viewer, x:short:editor, :nonametoken:editor', 'legacy-token-1')).toEqual([
      { name: 'chu', token: 'abcdefgh', role: 'editor' }, { name: 'ban', token: '12345678', role: 'viewer' }, { name: 'admin', token: 'legacy-token-1', role: 'editor' }])
    expect(parseAdmins('', 'short')).toEqual([])
    expect(parseAdmins('a:abcdefgh')[0].role).toBe('editor')
  })
  it('/me tells who is calling; a viewer can read but not change anything', async () => {
    expect(await (await call('GET', '/v1/admin/me', undefined, asAdmin)).json()).toEqual({ name: 'chu', role: 'editor' })
    expect(await (await call('GET', '/v1/admin/me', undefined, asViewer)).json()).toEqual({ name: 'ban', role: 'viewer' })
    expect((await call('GET', '/v1/admin/me')).status).toBe(401)
    expect((await call('GET', '/v1/admin/reviews', undefined, asViewer)).status).toBe(200)
    expect((await call('PUT', '/v1/admin/places', { places: PLACES }, asViewer)).status).toBe(403)
    await call('POST', '/v1/reviews', review)
    expect((await call('DELETE', '/v1/admin/reviews/1', undefined, asViewer)).status).toBe(403)
    expect((await call('DELETE', '/v1/admin/reviews/1')).status).toBe(401)
  })
  it('an editor deletes a review; deleting twice is a 404; every change is in the audit log with who did it', async () => {
    await call('POST', '/v1/reviews', review)
    const id = (await (await call('GET', '/v1/admin/reviews', undefined, asAdmin)).json()).reviews[0].id
    expect((await call('DELETE', `/v1/admin/reviews/${id}`, undefined, asAdmin)).status).toBe(200)
    expect((await call('DELETE', `/v1/admin/reviews/${id}`, undefined, asAdmin)).status).toBe(404)
    await call('PUT', '/v1/admin/places', { places: PLACES.slice(0, 3) }, asAdmin)
    await call('PUT', '/v1/admin/places', { places: [{ ...PLACES[0], name: 'Mới' }, PLACES[1], PLACES[4]] }, asAdmin)
    const entries = (await (await call('GET', '/v1/admin/audit', undefined, asViewer)).json()).entries
    expect(entries.map((e: { action: string }) => e.action)).toEqual(['places.save', 'places.save', 'review.delete'])
    expect(entries.every((e: { actor: string }) => e.actor === 'chu')).toBe(true)
    expect(entries[0].detail).toContain('thêm 1'); expect(entries[0].detail).toContain('sửa 1'); expect(entries[0].detail).toContain('xoá 1')
  })
  it('stats count devices, reviews and places without exposing any content', async () => {
    await call('PUT', '/v1/' + ID, { rev: 0, data: 'abc' })
    await call('PUT', '/v1/' + 'b'.repeat(64), { rev: 0, data: 'abc' })
    await call('POST', '/v1/reviews', review)
    await call('PUT', '/v1/admin/places', { places: PLACES.slice(0, 4) }, asAdmin)
    const { stats } = await (await call('GET', '/v1/admin/stats', undefined, asViewer)).json()
    expect(stats).toEqual({ syncDevices: 2, active7d: 2, active30d: 2, reviews: 1, reviews7d: 1, places: 4 })
  })
  it('limits reviews per visitor (5/hour) without affecting other visitors; no address → no limit', async () => {
    for (let i = 0; i < 5; i++) expect((await call('POST', '/v1/reviews', review, {}, ADMINS, '1.2.3.4')).status).toBe(201)
    const r = await call('POST', '/v1/reviews', review, {}, ADMINS, '1.2.3.4')
    expect(r.status).toBe(429); expect(r.headers.get('retry-after')).toBe('3600')
    expect((await call('POST', '/v1/reviews', review, {}, ADMINS, '5.6.7.8')).status).toBe(201)
    expect((await call('POST', '/v1/reviews', review)).status).toBe(201)
  })
})
