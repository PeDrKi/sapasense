// HTTP API (runs as a Cloudflare Worker; same code in tests and the local dev server).
//
//   Personal data (end-to-end encrypted; the server only sees an id hash + a blob)
//     GET  /v1/:id            → 200 { rev, data }        (rev 0 / data null when nothing is stored yet)
//     PUT  /v1/:id {rev,data} → 200 { rev }              (409 { rev, data } when rev is stale → client merges and retries)
//   Places
//     GET  /v1/places                → 200 { places }                    public
//     PUT  /v1/admin/places {places} → 200 { count }                     editor
//   Reviews
//     POST /v1/reviews {…}           → 201 { ok:true }                   public, validated, size-limited, 5 per hour per visitor
//     GET  /v1/admin/reviews?limit=  → 200 { reviews }                   viewer
//     DELETE /v1/admin/reviews/:id   → 200 { ok:true }                   editor
//   Admin
//     GET  /v1/admin/me              → 200 { name, role }                any admin (also used to check a token)
//     GET  /v1/admin/stats           → 200 { stats }                     viewer
//     GET  /v1/admin/audit?limit=    → 200 { entries }                   viewer
//   Admins are configured with the secret ADMIN_TOKENS = "name:token[:role],…" (role: viewer | editor, default editor);
//   the older single secret ADMIN_TOKEN still works and means editor "admin".
import type { Api } from './db'

export type { SyncRecord as Record_ } from './db'

const ID_RE = /^[a-f0-9]{64}$/
const DATA_RE = /^[A-Za-z0-9+/=_-]*$/
export const MAX_DATA = 60000
export const MAX_PLACES = 500
export const MAX_PLACE_BYTES = 8000
export const MAX_REVIEW_BYTES = 4000
export const REVIEW_LIMIT = 5                 // reviews per visitor …
export const REVIEW_WINDOW_MS = 3600 * 1000   // … per hour

export type Role = 'viewer' | 'editor'
export interface Admin { name: string; token: string; role: Role }

/** "alice:token1:editor, bob:token2:viewer"  (+ legacy single token). Entries with tokens shorter than 8 chars are ignored. */
export function parseAdmins(spec = '', legacyToken = ''): Admin[] {
  const out: Admin[] = []
  for (const part of spec.split(/[,\n]/)) {
    const [name, token, role] = part.trim().split(':').map(x => x?.trim())
    if (!name || !token || token.length < 8 || !/^[\w .-]{1,40}$/.test(name)) continue
    out.push({ name, token, role: role === 'viewer' ? 'viewer' : 'editor' })
  }
  if (legacyToken.length >= 8) out.push({ name: 'admin', token: legacyToken, role: 'editor' })
  return out
}

export function cors(origin = '*'): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const strArr = (x: unknown) => Array.isArray(x) && x.every(s => typeof s === 'string')

/** Same rules the app applies to places it loads: reject anything the recommender could choke on. */
export function validPlace(p: unknown): p is { id: string } & Record<string, unknown> {
  if (!isObj(p)) return false
  return typeof p.id === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(p.id)
    && typeof p.name === 'string' && p.name.length > 0 && p.name.length <= 200
    && Number.isFinite(p.lat) && Number.isFinite(p.lng)
    && strArr(p.moods) && strArr(p.groups) && strArr(p.timeOfDay)
    && typeof p.type === 'string'
    && Number.isFinite(p.cost) && Number.isFinite(p.duration)
}

/** Keep only known review fields, clamp lengths and ratings. Returns null when it is not a review at all. */
export function cleanReview(x: unknown): Record<string, unknown> | null {
  if (!isObj(x) || !isObj(x.ratings)) return null
  const s = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '')
  const ratings: Record<string, number> = {}
  for (const k of ['overall', 'relevance', 'accuracy', 'usability']) {
    const v = Number((x.ratings as Record<string, unknown>)[k])
    ratings[k] = Number.isFinite(v) ? Math.min(5, Math.max(0, Math.round(v))) : 0
  }
  if (ratings.overall < 1) return null
  return {
    date: s(x.date, 40), mood: s(x.mood, 20), timeLabel: s(x.timeLabel, 60), groupLabel: s(x.groupLabel, 60), budgetLabel: s(x.budgetLabel, 60),
    ratings, comment: s(x.comment, 1000),
    stops: Array.isArray(x.stops) ? x.stops.filter((v): v is string => typeof v === 'string').slice(0, 12).map(v => v.slice(0, 120)) : [],
  }
}

function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export interface HandleOpts { origin?: string; admins?: Admin[]; /** visitor address, used only to rate-limit (stored as a salted hash) */ ip?: string }

async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sapasense:ip:' + ip))
  return [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function handle(request: Request, api: Api, { origin = '*', admins = [], ip = '' }: HandleOpts = {}): Promise<Response> {
  const h = { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  const json = (obj: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(obj), { status, headers: { ...h, ...extra } })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })

  const url = new URL(request.url)
  const path = url.pathname

  const readBody = async (max: number): Promise<unknown | Response> => {
    const len = Number(request.headers.get('content-length') || 0)
    if (len > max) return json({ error: 'too large' }, 413)
    let text: string
    try { text = await request.text() } catch { return json({ error: 'bad body' }, 400) }
    if (text.length > max) return json({ error: 'too large' }, 413)
    try { return JSON.parse(text) } catch { return json({ error: 'bad json' }, 400) }
  }
  /** Resolve the caller: an Admin, or the error response to return (503 disabled, 401 bad token, 403 role too low). */
  const admin = (need: Role = 'viewer'): Admin | Response => {
    if (!admins.length) return json({ error: 'admin disabled' }, 503)
    const m = /^Bearer (.+)$/.exec(request.headers.get('authorization') || '')
    let found: Admin | null = null
    if (m) for (const a of admins) if (sameToken(m[1], a.token)) found = a      // no early exit: constant work per request
    if (!found) return json({ error: 'unauthorized' }, 401)
    if (need === 'editor' && found.role !== 'editor') return json({ error: 'forbidden' }, 403)
    return found
  }

  // ── places ──
  if (path === '/v1/places' && request.method === 'GET') {
    return json({ places: await api.listPlaces() }, 200, { 'Cache-Control': 'public, max-age=60' })
  }
  if (path === '/v1/admin/places' && request.method === 'PUT') {
    const who = admin('editor'); if (who instanceof Response) return who
    const body = await readBody(MAX_PLACES * MAX_PLACE_BYTES)
    if (body instanceof Response) return body
    const list = isObj(body) ? body.places : null
    if (!Array.isArray(list) || list.length === 0 || list.length > MAX_PLACES) return json({ error: 'bad places' }, 400)
    const ids = new Set<string>()
    for (const p of list) {
      if (!validPlace(p) || JSON.stringify(p).length > MAX_PLACE_BYTES || ids.has(p.id)) return json({ error: 'bad place', id: isObj(p) ? p.id : null }, 400)
      ids.add(p.id)
    }
    const before = new Map((await api.listPlaces() as { id: string }[]).map(p => [p.id, JSON.stringify(p)]))
    const after = new Map((list as { id: string }[]).map(p => [p.id, JSON.stringify(p)]))
    const added = [...after.keys()].filter(k => !before.has(k)), removed = [...before.keys()].filter(k => !after.has(k))
    const changed = [...after.keys()].filter(k => before.has(k) && before.get(k) !== after.get(k))
    await api.replacePlaces(list as { id: string }[])
    await api.audit(who.name, 'places.save', `${list.length} địa điểm · thêm ${added.length}${added.length ? ' (' + added.slice(0, 5).join(', ') + ')' : ''} · sửa ${changed.length}${changed.length ? ' (' + changed.slice(0, 5).join(', ') + ')' : ''} · xoá ${removed.length}${removed.length ? ' (' + removed.slice(0, 5).join(', ') + ')' : ''}`)
    return json({ count: list.length })
  }

  // ── reviews ──
  if (path === '/v1/reviews' && request.method === 'POST') {
    const body = await readBody(MAX_REVIEW_BYTES * 2)
    if (body instanceof Response) return body
    const review = cleanReview(body)
    if (!review) return json({ error: 'bad review' }, 400)
    if (ip && !(await api.hit('review:' + (await hashIp(ip)), REVIEW_LIMIT, REVIEW_WINDOW_MS))) return json({ error: 'too many' }, 429, { 'Retry-After': '3600' })
    const out = JSON.stringify(review)
    if (out.length > MAX_REVIEW_BYTES) return json({ error: 'too large' }, 413)
    return (await api.addReview(out)) === 'full' ? json({ error: 'full' }, 429) : json({ ok: true }, 201)
  }
  if (path === '/v1/admin/reviews' && request.method === 'GET') {
    const who = admin(); if (who instanceof Response) return who
    const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit')) || 500))
    return json({ reviews: await api.listReviews(limit) })
  }

  const del = /^\/v1\/admin\/reviews\/(\d{1,12})$/.exec(path)
  if (del && request.method === 'DELETE') {
    const who = admin('editor'); if (who instanceof Response) return who
    const ok = await api.deleteReview(Number(del[1]))
    if (!ok) return json({ error: 'not found' }, 404)
    await api.audit(who.name, 'review.delete', `đánh giá #${del[1]}`)
    return json({ ok: true })
  }

  // ── admin: who am I, numbers, history ──
  if (path === '/v1/admin/me' && request.method === 'GET') {
    const who = admin(); if (who instanceof Response) return who
    return json({ name: who.name, role: who.role })
  }
  if (path === '/v1/admin/stats' && request.method === 'GET') {
    const who = admin(); if (who instanceof Response) return who
    return json({ stats: await api.stats() })
  }
  if (path === '/v1/admin/audit' && request.method === 'GET') {
    const who = admin(); if (who instanceof Response) return who
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 100))
    return json({ entries: await api.listAudit(limit) })
  }

  // ── encrypted personal data ──
  const m = path.match(/^\/v1\/([^/]+)$/)
  if (!m || !ID_RE.test(m[1])) return json({ error: 'bad id' }, 400)
  const id = m[1]

  if (request.method === 'GET') {
    const cur = await api.getSync(id)
    return json(cur ? { rev: cur.rev, data: cur.data } : { rev: 0, data: null })
  }
  if (request.method === 'PUT') {
    const body = await readBody(MAX_DATA + 200)
    if (body instanceof Response) return body
    const b = body as { rev?: unknown; data?: unknown } | null
    if (!b || typeof b.rev !== 'number' || !Number.isInteger(b.rev) || b.rev < 0 || typeof b.data !== 'string' || b.data.length > MAX_DATA || !DATA_RE.test(b.data)) {
      return json({ error: 'bad body' }, 400)
    }
    const res = await api.putSync(id, b.rev, b.data)
    return res.ok ? json({ rev: res.rev }) : json({ rev: res.cur.rev, data: res.cur.data }, 409)
  }
  return json({ error: 'method not allowed' }, 405)
}
