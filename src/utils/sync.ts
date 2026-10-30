// Two-device sync without accounts.
//  • The user gets a secret code (e.g. K7M2-9QXD-…) on device A and types it on device B.
//  • The server only sees SHA-256(code) as the storage id and an AES-GCM encrypted blob (key derived from the code),
//    so it can neither read nor guess anyone's places.
//  • Data is merged with the last-writer-wins rules in memory.js; the server rejects stale writes (409) and we retry.
import { API_URL } from '../config'
import { getState, mergeRemote, normalize, mergeStates } from './memory'
import type { MemoryState } from '../types'

export interface SyncConfig { code?: string; rev?: number; lastSync?: number; error?: string }
export interface SyncStatus { on: boolean; code: string; lastSync: number; error: string }
export interface SyncResult { ok: boolean; pushed?: boolean; code?: string; reason?: 'off' | 'decrypt' | 'network' | 'format' | 'notfound' }
interface Remote { rev: number; data: string | null }
export interface SyncDeps { base: string; storage: Pick<Storage, 'getItem' | 'setItem'>; fetchImpl: (input: string, init?: RequestInit) => Promise<Response>; emit?: (name: string) => void }

const CFG = 'ss_sync'
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'   // no 0/O/1/I/L
const enc = new TextEncoder(), dec = new TextDecoder()

export const normalizeCode = (c: unknown): string => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
export const formatCode = (c: unknown): string => normalizeCode(c).match(/.{1,4}/g)?.join('-') || ''
export function newCode(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = rand(20); let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return formatCode(out)
}

const toB64 = (u8: Uint8Array) => { let s = ''; u8.forEach(b => { s += String.fromCharCode(b) }); return btoa(s) }
const fromB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')

export async function deriveId(code: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode('sapasense:id:' + normalizeCode(code))))
}
async function deriveKey(code: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(normalizeCode(code)), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name:'PBKDF2', salt:enc.encode('sapasense:key'), iterations:100000, hash:'SHA-256' }, base, { name:'AES-GCM', length:256 }, false, ['encrypt', 'decrypt'])
}
export async function encryptState(code: string, state: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv }, await deriveKey(code), enc.encode(JSON.stringify(state))))
  const out = new Uint8Array(iv.length + ct.length); out.set(iv); out.set(ct, iv.length)
  return toB64(out)
}
export async function decryptState(code: string, data: string): Promise<MemoryState> {
  const u = fromB64(data)
  const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv:u.slice(0, 12) }, await deriveKey(code), u.slice(12))
  return normalize(JSON.parse(dec.decode(pt)))
}

const canon = (o: unknown) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1)) : v)

export function createSync({ base, storage, fetchImpl, emit = () => {} }: SyncDeps) {
  const url = (id: string) => `${base.replace(/\/$/, '')}/v1/${id}`
  const load = (): SyncConfig => { try { return JSON.parse(storage.getItem(CFG) || '{}') } catch { return {} } }
  const save = (c: SyncConfig) => { try { storage.setItem(CFG, JSON.stringify(c)) } catch { /* ignore */ } emit('ss-sync-status') }
  const get = async (id: string): Promise<Remote> => { const r = await fetchImpl(url(id)); if (!r.ok) throw new Error('http ' + r.status); return r.json() }
  const put = (id: string, rev: number, data: string) => fetchImpl(url(id), { method:'PUT', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ rev, data }) })

  async function syncNow(): Promise<SyncResult> {
    const cfg = load()
    if (!cfg.code) return { ok:false, reason:'off' }
    try {
      const id = await deriveId(cfg.code)
      for (let attempt = 0; attempt < 4; attempt++) {
        const cur = await get(id)
        let remote: MemoryState | null = null
        if (cur.data) {
          try { remote = await decryptState(cfg.code, cur.data) } catch { save({ ...cfg, error:'decrypt' }); return { ok:false, reason:'decrypt' } }
          if (mergeRemote(remote)) emit('ss-memory-synced')
        }
        const local = getState()
        if (remote && canon(mergeStates(remote, local)) === canon(remote)) {   // server already has everything we have
          save({ ...cfg, rev:cur.rev, lastSync:Date.now(), error:'' }); return { ok:true, pushed:false }
        }
        const res = await put(id, cur.rev, await encryptState(cfg.code, local))
        if (res.status === 409) continue
        if (!res.ok) throw new Error('http ' + res.status)
        const { rev } = await res.json()
        save({ ...cfg, rev, lastSync:Date.now(), error:'' }); return { ok:true, pushed:true }
      }
      throw new Error('conflict')
    } catch (e) {
      save({ ...load(), error: String((e as Error).message || e) }); return { ok:false, reason:'network' }
    }
  }

  /** First device: make a new code and upload what we have. */
  async function enable(): Promise<SyncResult> {
    const code = newCode()
    save({ code })
    const r = await syncNow()
    if (!r.ok) save({})
    return r.ok ? { ok:true, code } : r
  }
  /** Second device: the code must already have data on the server (protects against typos creating an empty space). */
  async function join(code: string): Promise<SyncResult> {
    const norm = normalizeCode(code)
    if (norm.length !== 20) return { ok:false, reason:'format' }
    try {
      const cur = await get(await deriveId(norm))
      if (!cur.data) return { ok:false, reason:'notfound' }
    } catch { return { ok:false, reason:'network' } }
    save({ code:formatCode(norm) })
    const r = await syncNow()
    if (!r.ok) save({})
    return r.ok ? { ok:true } : r
  }
  const disable = () => save({})
  return { syncNow, enable, join, disable, status:(): SyncStatus => { const c = load(); return { on:!!c.code, code:c.code || '', lastSync:c.lastSync || 0, error:c.error || '' } } }
}

// ── app wiring ──
export const SYNC_URL = API_URL
let app: ReturnType<typeof createSync> | null = null
export function appSync() {
  if (!SYNC_URL) return null
  if (!app) app = createSync({ base:SYNC_URL, storage:localStorage, fetchImpl:(i, init) => fetch(i, init), emit:(n: string) => { try { window.dispatchEvent(new Event(n)) } catch { /* ignore */ } } })
  return app
}

/** Sync on start, after local changes (debounced), when the tab becomes visible again, and when back online. */
export function startAutoSync() {
  const s = appSync(); if (!s) return () => {}
  let timer: ReturnType<typeof setTimeout> | undefined, last = 0
  const run = () => { if (!s.status().on) return; last = Date.now(); s.syncNow() }
  const soon = () => { clearTimeout(timer); timer = setTimeout(run, 2500) }
  const wake = () => { if (document.visibilityState === 'visible' && Date.now() - last > 20000) run() }
  window.addEventListener('ss-memory-changed', soon)
  document.addEventListener('visibilitychange', wake)
  window.addEventListener('online', run)
  const first = setTimeout(run, 800)
  return () => { clearTimeout(timer); clearTimeout(first); window.removeEventListener('ss-memory-changed', soon); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', run) }
}
