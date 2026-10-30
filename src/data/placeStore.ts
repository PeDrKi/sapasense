import { PLACES } from './places'
import type { Place } from '../types'
import { API_URL } from '../config'

export const LS_PLACES = 'sapasense_admin_places'
export const LS_REMOTE = 'ss_remote_places'   // last list fetched from the server (used when the API is configured)

function isValid(p: any): boolean {
  return p && typeof p.id === 'string' && p.id && typeof p.name === 'string'
    && Number.isFinite(+p.lat) && Number.isFinite(+p.lng)
    && Array.isArray(p.moods) && Array.isArray(p.groups) && Array.isArray(p.timeOfDay)
}

function normalize(p: any): Place {
  return {
    ...p,
    lat: +p.lat, lng: +p.lng,
    cost: Number(p.cost) || 0,
    duration: Number(p.duration) || 60,
    badges: Array.isArray(p.badges) ? p.badges : [],
    area: p.area || '',
    desc: p.desc || '',
    tip: p.tip || '',
    type: p.type || 'attraction',
  }
}

/** Valid places from a stored/fetched list. */
function clean(arr: unknown): Place[] { return Array.isArray(arr) ? arr.filter(isValid).map(normalize) : [] }

/**
 * Places used by the whole app.
 * With the API configured: the last list fetched from the server, else the built-in data.
 * Without it: the list edited in this browser's Admin screen if present and valid, else the built-in data.
 */
export function getPlaces(): Place[] {
  try {
    const raw = localStorage.getItem(API_URL ? LS_REMOTE : LS_PLACES)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        const ok = arr.filter(isValid).map(normalize)
        if (ok.length) return ok
      }
    }
  } catch { /* fall through */ }
  return PLACES
}

/** Fetch the shared list once at start; the next plan uses it. Never throws. */
export async function refreshRemotePlaces(): Promise<boolean> {
  if (!API_URL) return false
  try {
    const r = await fetch(API_URL + '/v1/places')
    if (!r.ok) return false
    const list = clean((await r.json()).places)
    if (!list.length) return false          // empty server table: keep built-in data
    const prev = localStorage.getItem(LS_REMOTE)
    const next = JSON.stringify(list)
    if (prev === next) return false
    localStorage.setItem(LS_REMOTE, next)
    try { window.dispatchEvent(new Event('ss-places-changed')) } catch { /* ignore */ }
    return true
  } catch { return false }
}

/** Remember a list the Admin has just saved to the server. */
export function cacheRemotePlaces(list: Place[]) {
  try { localStorage.setItem(LS_REMOTE, JSON.stringify(list)) } catch { /* ignore */ }
}

export function savePlaces(list: Place[]) {
  try { localStorage.setItem(LS_PLACES, JSON.stringify(list)) } catch { /* ignore */ }
}

export function resetPlaces(): Place[] {
  try { localStorage.removeItem(LS_PLACES); localStorage.removeItem(LS_REMOTE) } catch { /* ignore */ }
  return PLACES
}
