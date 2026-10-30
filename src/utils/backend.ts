// Calls to the Worker API for reviews and the Admin screen. Everything here is optional: without API_URL the app
// keeps working from the browser alone.
import { API_URL } from '../config'
import type { Place, Review } from '../types'

export type AdminReview = Review & { id?: number; createdAt?: number }

const TOKEN_KEY = 'sapasense_admin_token'
export const getAdminToken = (): string => { try { return sessionStorage.getItem(TOKEN_KEY) || '' } catch { return '' } }
export const setAdminToken = (t: string) => { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } }

const auth = (token: string): Record<string, string> => ({ Authorization: 'Bearer ' + token })

/** Fire-and-forget: the review is already saved locally, so a failure here is not shown to the user. */
export async function postReview(review: Review): Promise<boolean> {
  if (!API_URL) return false
  try {
    const r = await fetch(API_URL + '/v1/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(review) })
    return r.ok
  } catch { return false }
}

export type Role = 'viewer' | 'editor'
export interface AdminMe { name: string; role: Role }
export interface AdminStats { syncDevices: number; active7d: number; active30d: number; reviews: number; reviews7d: number; places: number }
export interface AuditEntry { id: number; at: number; actor: string; action: string; detail: string }

/** The signed-in admin, `false` = token rejected, `null` = server not reachable / admin not enabled. */
export async function adminMe(token: string): Promise<AdminMe | false | null> {
  if (!API_URL) return null
  try {
    const r = await fetch(API_URL + '/v1/admin/me', { headers: auth(token) })
    if (r.status === 401) return false
    return r.ok ? ((await r.json()) as AdminMe) : null
  } catch { return null }
}

export async function adminReviews(token: string): Promise<AdminReview[]> {
  const r = await fetch(API_URL + '/v1/admin/reviews?limit=1000', { headers: auth(token) })
  if (!r.ok) throw new Error('http ' + r.status)
  return (await r.json()).reviews as AdminReview[]
}

export async function adminSavePlaces(token: string, places: Place[]): Promise<void> {
  const r = await fetch(API_URL + '/v1/admin/places', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth(token) }, body: JSON.stringify({ places }) })
  if (!r.ok) {
    let detail = ''
    try { const j = await r.json(); detail = j.id ? ` (${j.id})` : '' } catch { /* ignore */ }
    throw new Error('http ' + r.status + detail)
  }
}

async function getJson<T>(path: string, token: string): Promise<T> {
  const r = await fetch(API_URL + path, { headers: auth(token) })
  if (!r.ok) throw new Error('http ' + r.status)
  return r.json() as Promise<T>
}
export const adminStats = async (token: string) => (await getJson<{ stats: AdminStats }>('/v1/admin/stats', token)).stats
export const adminAudit = async (token: string) => (await getJson<{ entries: AuditEntry[] }>('/v1/admin/audit?limit=200', token)).entries

export async function adminDeleteReview(token: string, id: number): Promise<void> {
  const r = await fetch(API_URL + '/v1/admin/reviews/' + id, { method: 'DELETE', headers: auth(token) })
  if (!r.ok) throw new Error('http ' + r.status)
}
