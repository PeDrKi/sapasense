// What the user has already seen / visited / saved / never wants to see again. Lives in this browser (localStorage)
// and can be synced between devices (see sync.js).
//
// State v2:  { v:2, marks:{ fav:{id:{t,on}}, visited:{…}, hidden:{…} }, shown:{id:'YYYY-MM-DD'}, history:{day:{ids,t}} }
// Every mark is a last-writer-wins register ({t: timestamp, on: boolean}), so removing a favourite or un-hiding a place
// on one device is also propagated by a merge instead of being "resurrected" by the other device.
import type { MarkKind, MemoryState } from '../types'

const KEY = 'ss_memory'
const WEEK = 7 * 24 * 3600 * 1000
const KINDS: MarkKind[] = ['fav', 'visited', 'hidden']
const idOk = (k: unknown): k is string => typeof k === 'string' && /^[A-Za-z0-9_-]{1,20}$/.test(k)
const dayOk = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)

const empty = (): MemoryState => ({ v:2, marks:{ fav:{}, visited:{}, hidden:{} }, shown:{}, history:{} })

/** Clean any untrusted / old-format object into a valid v2 state. */
export function normalize(rawIn: unknown): MemoryState {
  const s = empty()
  const raw = rawIn as any
  if (!raw || typeof raw !== 'object') return s
  if (raw.v === 2 && raw.marks) {
    for (const k of KINDS) for (const [id, m] of Object.entries<any>(raw.marks[k] || {})) {
      if (idOk(id) && m && Number.isFinite(+m.t)) s.marks[k][id] = { t:+m.t, on:!!m.on }
    }
    for (const [id, d] of Object.entries(raw.shown || {})) if (idOk(id) && dayOk(d)) s.shown[id] = d
    for (const [d, h] of Object.entries<any>(raw.history || {})) {
      if (dayOk(d) && h && Array.isArray(h.ids) && Number.isFinite(+h.t)) s.history[d] = { ids: h.ids.filter(idOk).slice(0, 12), t:+h.t }
    }
    return s
  }
  // v1 (before sync): favs/visited maps of timestamps, hidden array, history day→ids
  const t0 = 1
  for (const [id, t] of Object.entries<any>(raw.favs || {})) if (idOk(id)) s.marks.fav[id] = { t:Number.isFinite(+t) ? +t : t0, on:true }
  for (const [id, t] of Object.entries<any>(raw.visited || {})) if (idOk(id)) s.marks.visited[id] = { t:Number.isFinite(+t) ? +t : t0, on:true }
  for (const id of (Array.isArray(raw.hidden) ? raw.hidden : [])) if (idOk(id)) s.marks.hidden[id] = { t:t0, on:true }
  for (const [id, d] of Object.entries(raw.shown || {})) if (idOk(id) && dayOk(d)) s.shown[id] = d
  for (const [d, ids] of Object.entries<any>(raw.history || {})) if (dayOk(d) && Array.isArray(ids)) s.history[d] = { ids: ids.filter(idOk).slice(0, 12), t:t0 }
  return s
}

/** Merge two states: per mark the newer write wins; per place the later "shown" day; per day the newer plan. */
export function mergeStates(a: unknown, b: unknown): MemoryState {
  const out = normalize(a), o = normalize(b)
  for (const k of KINDS) for (const [id, m] of Object.entries(o.marks[k])) {
    const cur = out.marks[k][id]
    if (!cur || m.t > cur.t) out.marks[k][id] = m
  }
  for (const [id, d] of Object.entries(o.shown)) if (!out.shown[id] || d > out.shown[id]) out.shown[id] = d
  for (const [d, h] of Object.entries(o.history)) if (!out.history[d] || h.t > out.history[d].t) out.history[d] = h
  return prune(out)
}

function prune(s: MemoryState): MemoryState {
  const keep = Object.keys(s.history).sort().slice(-40)
  s.history = Object.fromEntries(keep.map(k => [k, s.history[k]]))
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000
  for (const [id, d] of Object.entries(s.shown)) if (new Date(d).getTime() < cutoff) delete s.shown[id]
  return s
}

function read(): MemoryState {
  try { return normalize(JSON.parse(localStorage.getItem(KEY) || 'null')) } catch { return empty() }
}
function write(s: MemoryState, { silent = false }: { silent?: boolean } = {}) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode etc. */ }
  if (!silent) { try { window.dispatchEvent(new Event('ss-memory-changed')) } catch { /* not in a browser */ } }
}

const on = (s: MemoryState, k: MarkKind): string[] => Object.entries(s.marks[k]).filter(([, m]) => m.on).map(([id]) => id)
const mark = (k: MarkKind, id: string, value: boolean) => { const s = read(); s.marks[k][id] = { t:Date.now(), on:value }; write(s) }

/** Remember the places of a plan shown on `dayISO`. */
export function noteShown(ids: string[], dayISO: string) {
  const s = read(); ids.forEach(id => { s.shown[id] = dayISO })
  s.history[dayISO] = { ids: ids.slice(0, 12), t:Date.now() }
  write(prune(s))
}
export function noteVisited(id: string, value: unknown) { mark('visited', id, !!value) }
export function hidePlace(id: string)   { mark('hidden', id, true) }
export function unhidePlace(id: string) { mark('hidden', id, false) }
export function clearHidden()   { const s = read(); const t = Date.now(); for (const id of on(s, 'hidden')) s.marks.hidden[id] = { t, on:false }; write(s) }
export function toggleFav(id: string): boolean { const s = read(); const now = !s.marks.fav[id]?.on; s.marks.fav[id] = { t:Date.now(), on:now }; write(s); return now }
export function favIds()        { return on(read(), 'fav') }
export function hiddenCount()   { return on(read(), 'hidden').length }
/** Forget everything — as writes (not a wipe) so that a synced device forgets too. */
export function clearMemory() {
  const s = read(), t = Date.now()
  for (const k of KINDS) for (const id of on(s, k)) s.marks[k][id] = { t, on:false }
  s.shown = {}; s.history = {}
  write(s)
}

/** View used by the UI: { shown, visited:{id:t}, hidden:[ids], favs:{id:t}, history:{day:[ids]} } */
export function getMemory() {
  const s = read()
  const map = (k: MarkKind): Record<string, number> => Object.fromEntries(Object.entries(s.marks[k]).filter(([, m]) => m.on).map(([id, m]) => [id, m.t]))
  return { shown: s.shown, visited: map('visited'), hidden: on(s, 'hidden'), favs: map('fav'), history: Object.fromEntries(Object.entries(s.history).map(([d, h]) => [d, h.ids])) }
}

/** Extra answers fields for the recommender. Places shown *today* are not "recent", so reloads keep today's plan. */
export function memoryForAnswers(todayISO: string) {
  const s = read()
  const recent = Object.entries(s.shown).filter(([, d]) => d < todayISO && Date.now() - new Date(d).getTime() < WEEK).map(([id]) => id)
  return { recent, visited: on(s, 'visited'), hidden: on(s, 'hidden'), favs: on(s, 'fav') }
}

// ── low-level access for sync.js ──
export function getState() { return read() }
/** Merge a remote state into this device. Returns true when the local state changed. */
export function mergeRemote(remote: unknown, { silent = true }: { silent?: boolean } = {}): boolean {
  const local = read()
  const merged = mergeStates(local, remote)
  const changed = JSON.stringify(merged) !== JSON.stringify(local)
  if (changed) write(merged, { silent })
  return changed
}

// ── manual backup code (works without any server) ──
const b64 = (str: string) => btoa(unescape(encodeURIComponent(str)))
const unb64 = (str: string) => decodeURIComponent(escape(atob(str)))

export function exportMemory() { return 'SS1.' + b64(JSON.stringify(read())) }

/** Merge a backup code (SS1.…, or the older HN1./HN2.… codes) into this device. */
export function importMemory(code: unknown): { ok: false } | { ok: true; favs: number; visited: number; hidden: number } {
  try {
    const raw = String(code || '').trim()
    if (!['SS1.', 'HN1.', 'HN2.'].some(pre => raw.startsWith(pre))) return { ok:false }
    const inc = JSON.parse(unb64(raw.slice(4)))
    if (!inc || typeof inc !== 'object') return { ok:false }
    // an explicit restore means "I want these back": incoming positive marks count as written now
    const incN = normalize(inc), local = read()
    // strictly newer than anything already stored, so a restore wins even within the same millisecond as a clear
    let now = Date.now()
    for (const k of KINDS) for (const m of Object.values(local.marks[k])) if (m.t >= now) now = m.t + 1
    for (const k of KINDS) for (const m of Object.values(incN.marks[k])) if (m.on) m.t = now
    const merged = mergeStates(local, incN)
    write(merged)
    return { ok:true, favs:on(merged, 'fav').length, visited:on(merged, 'visited').length, hidden:on(merged, 'hidden').length }
  } catch { return { ok:false } }
}
