import { describe, it, expect, beforeEach } from 'vitest'
import { handle } from '../../../sync-server/handler'
import { d1Api, type Api } from '../../../sync-server/db'
import { sqliteD1 } from '../../../sync-server/sqlite-shim'
import { createSync, newCode, normalizeCode, formatCode, encryptState, decryptState, deriveId } from '../sync'
import { toggleFav, favIds, hidePlace, unhidePlace, getMemory, clearMemory, normalize } from '../memory'

// one fake "server" shared by two simulated devices, each with its own localStorage
let api: Api = d1Api(sqliteD1())   // real SQL, in-memory SQLite
const fakeFetch = async (url: string, init: RequestInit = {}) => handle(new Request(url, init), api)

function device() {
  const ls: Record<string, string> = {}
  const storage = { getItem:(k: string) => ls[k] ?? null, setItem:(k: string, v: string) => { ls[k] = String(v) }, removeItem:(k: string) => { delete ls[k] } }
  return { ls, storage, sync: createSync({ base:'http://sync.test', storage, fetchImpl:fakeFetch }) }
}
// memory.js reads globalThis.localStorage — switch it to the active device
type Device = ReturnType<typeof device>
const use = (d: Device) => { (globalThis as any).localStorage = d.storage }

describe('sync crypto', () => {
  it('codes: 20 chars, grouped, normalised', () => {
    const c = newCode(); expect(c).toMatch(/^([A-Z2-9]{4}-){4}[A-Z2-9]{4}$/)
    expect(normalizeCode(' k7m2-9qxd ')).toBe('K7M29QXD'); expect(formatCode('abcd1234')).toBe('ABCD-1234')
  })
  it('encrypts and decrypts; a wrong code cannot read it; the server id hides the code', async () => {
    const code = newCode(), st = normalize({ favs:{ HK001:5 } })
    const blob = await encryptState(code, st)
    expect(blob).not.toContain('HK001')
    expect((await decryptState(code, blob)).marks.fav.HK001.on).toBe(true)
    await expect(decryptState(newCode(), blob)).rejects.toBeTruthy()
    const id = await deriveId(code); expect(id).toMatch(/^[a-f0-9]{64}$/); expect(id).not.toContain(normalizeCode(code))
  })
})

describe('two devices', () => {
  let A: Device, B: Device
  beforeEach(() => { api = d1Api(sqliteD1()); A = device(); B = device() })

  it('A enables, B joins with the code and receives A’s data; changes flow both ways, including removals', async () => {
    use(A); clearMemory(); toggleFav('HK001'); hidePlace('TD003')
    const en = await A.sync.enable(); expect(en.ok).toBe(true)

    use(B); clearMemory()
    expect((await B.sync.join('AAAA-BBBB-CCCC-DDDD-EEEE')).reason).toBe('notfound')   // wrong code is not silently accepted
    expect((await B.sync.join('abc')).reason).toBe('format')
    expect((await B.sync.join(en.code!)).ok).toBe(true)
    expect(favIds()).toEqual(['HK001']); expect(getMemory().hidden).toEqual(['TD003'])

    toggleFav('HK001'); unhidePlace('TD003'); toggleFav('PC003')        // B removes two things and adds one
    expect((await B.sync.syncNow()).ok).toBe(true)

    use(A); expect((await A.sync.syncNow()).ok).toBe(true)
    expect(favIds().sort()).toEqual(['PC003']); expect(getMemory().hidden).toEqual([])
  })

  it('concurrent edits on both devices are both kept (409 → merge → retry)', async () => {
    use(A); clearMemory(); const en = await A.sync.enable()
    use(B); clearMemory(); await B.sync.join(en.code!)
    use(A); toggleFav('HK001')
    use(B); toggleFav('PC003')
    use(A); await A.sync.syncNow()
    use(B); await B.sync.syncNow()
    use(A); await A.sync.syncNow()
    expect(favIds().sort()).toEqual(['HK001', 'PC003'])
    use(B); expect(favIds().sort()).toEqual(['HK001', 'PC003'])
  })

  it('reports network errors without losing local data, and can be switched off', async () => {
    use(A); clearMemory(); toggleFav('HK001')
    const bad = createSync({ base:'http://x', storage:A.storage, fetchImpl: async () => { throw new Error('offline') } })
    A.storage.setItem('ss_sync', JSON.stringify({ code:newCode() }))
    expect((await bad.syncNow()).reason).toBe('network'); expect(favIds()).toEqual(['HK001'])
    bad.disable(); expect(bad.status().on).toBe(false); expect((await bad.syncNow()).reason).toBe('off')
  })
})
