import { useState, useEffect, type ReactNode } from 'react'
import { Grain, BtnPrimary, BtnSecondary } from '../components/ui'
import LangToggle from '../components/LangToggle'
import { C } from '../styles/tokens'
import { useT } from '../i18n'
import { getPlaces } from '../data/placeStore'
import { appSync, type SyncStatus, type SyncResult } from '../utils/sync'
import { getMemory, toggleFav, unhidePlace, exportMemory, importMemory, clearMemory } from '../utils/memory'

function Section({ title, count, children }: { title: string; count: number | string; children?: ReactNode }) {
  return (
    <section style={{ marginBottom:'1.6rem' }}>
      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.1rem', marginBottom:8 }}>{title}{count !== '' && <> <span style={{ fontSize:'0.78rem', color:C.muted, fontFamily:"'Be Vietnam Pro',sans-serif" }}>({count})</span></>}</h2>
      {children}
    </section>
  )
}

export default function MineScreen({ onHome }: { onHome: () => void }) {
  const t = useT().mine
  const places = getPlaces()
  const name = (id: string) => places.find(p => p.id === id)?.name || id
  const [m, setM] = useState(getMemory)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const refresh = () => setM(getMemory())
  const sync = appSync()
  const [st, setSt] = useState<SyncStatus>(() => sync?.status() || { on:false, code:'', lastSync:0, error:'' })
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const a = () => setM(getMemory()), b = () => sync && setSt(sync.status())
    window.addEventListener('ss-memory-synced', a); window.addEventListener('ss-sync-status', b)
    return () => { window.removeEventListener('ss-memory-synced', a); window.removeEventListener('ss-sync-status', b) }
  }, [sync])
  const run = async (fn: () => Promise<SyncResult>) => { if (!sync) return; setBusy(true); setMsg(''); const r = await fn(); setBusy(false); setSt(sync.status()); if (!r.ok) setMsg((t.syncErr as Record<string, string>)[r.reason ?? 'network'] || t.syncErr.network); return r }
  const doEnable = () => run(() => sync!.enable())
  const doJoin = async () => { const r = await run(() => sync!.join(joinCode)); if (r?.ok) { setJoinCode(''); refresh() } }
  const doNow = async () => { const r = await run(() => sync!.syncNow()); if (r?.ok) setMsg(t.synced) }
  const copyCode = async () => { try { await navigator.clipboard.writeText(st.code); setMsg(t.copied) } catch { setMsg(st.code) } }
  const favs = Object.keys(m.favs).filter(id => places.some(p => p.id === id))
  const visited = Object.keys(m.visited).filter(id => places.some(p => p.id === id))
  const hidden = m.hidden.filter(id => places.some(p => p.id === id))
  const days = Object.keys(m.history).sort().reverse().slice(0, 14)

  const btn = { fontSize:'0.74rem', padding:'0.25rem 0.65rem', cursor:'pointer', background:'none', border:`1px solid ${C.border}`, color:C.ink, fontFamily:"'Be Vietnam Pro',sans-serif" }
  const row = (id: string, action: ReactNode) => (
    <li key={id} style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center', padding:'0.4rem 0', borderBottom:`1px solid ${C.border}`, fontSize:'0.85rem' }}>
      <span>{name(id)}</span>{action}
    </li>
  )
  const empty = (txt: string) => <p style={{ fontSize:'0.8rem', color:C.muted }}>{txt}</p>

  const doCopy = async () => {
    const c = exportMemory()
    try { await navigator.clipboard.writeText(c); setMsg(t.copied) } catch { setCode(c); setMsg(t.copyFallback) }
  }
  const doImport = () => {
    const r = importMemory(code)
    if (!r.ok) { setMsg(t.badCode); return }
    setCode(''); refresh(); setMsg(t.restored(r.favs, r.hidden))
  }

  return (
    <div style={{ minHeight:'100vh', background:C.cream, padding:'1.25rem', position:'relative' }}>
      <Grain/>
      <div style={{ position:'relative', zIndex:1, maxWidth:640, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.2rem' }}>
          <LangToggle/>
          <BtnSecondary onClick={onHome} style={{ fontSize:'0.77rem', padding:'0.5rem 0.9rem' }}>{t.back}</BtnSecondary>
        </div>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.5rem', marginBottom:4 }}>{t.title}</h1>
        <p style={{ fontSize:'0.8rem', color:C.muted, marginBottom:'1.5rem' }}>{t.sub}</p>

        <Section title={t.favs} count={favs.length}>
          {favs.length ? <ul style={{ listStyle:'none', padding:0, margin:0 }}>{favs.map(id => row(id, <button type="button" style={btn} onClick={() => { toggleFav(id); refresh() }}>{t.remove}</button>))}</ul> : empty(t.favsEmpty)}
        </Section>
        <Section title={t.history} count={days.length}>
          {days.length ? <ul style={{ listStyle:'none', padding:0, margin:0 }}>{days.map(d => (
            <li key={d} style={{ padding:'0.45rem 0', borderBottom:`1px solid ${C.border}`, fontSize:'0.82rem' }}>
              <strong style={{ fontSize:'0.76rem', color:C.rust }}>{d}</strong><br/>{m.history[d].map(name).join(' → ')}
            </li>))}</ul> : empty(t.historyEmpty)}
        </Section>
        <Section title={t.visited} count={visited.length}>
          {visited.length ? <p style={{ fontSize:'0.82rem', lineHeight:1.7 }}>{visited.map(name).join(' · ')}</p> : empty(t.visitedEmpty)}
        </Section>
        <Section title={t.hidden} count={hidden.length}>
          {hidden.length ? <ul style={{ listStyle:'none', padding:0, margin:0 }}>{hidden.map(id => row(id, <button type="button" style={btn} onClick={() => { unhidePlace(id); refresh() }}>{t.unhide}</button>))}</ul> : empty(t.hiddenEmpty)}
        </Section>

        <Section title={t.sync} count="">
          {!sync ? <p style={{ fontSize:'0.78rem', color:C.muted, lineHeight:1.6 }}>{t.syncOff}</p> : st.on ? (
            <div>
              <p style={{ fontSize:'0.78rem', color:C.muted, lineHeight:1.6, marginBottom:8 }}>{t.syncOn}</p>
              <code data-testid="sync-code" style={{ display:'block', padding:'0.6rem', background:C.card, border:`1px solid ${C.border}`, fontSize:'0.9rem', letterSpacing:'0.05em', marginBottom:8, wordBreak:'break-all' }}>{st.code}</code>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                <button type="button" style={btn} onClick={copyCode}>{t.copyCode}</button>
                <button type="button" style={btn} onClick={doNow} disabled={busy}>{busy ? '…' : t.syncNow}</button>
                <button type="button" style={btn} onClick={() => { if (window.confirm(t.confirmOff)) { sync!.disable(); setSt(sync!.status()) } }}>{t.syncDisable}</button>
              </div>
              <div style={{ fontSize:'0.74rem', color: st.error ? C.rust : C.muted }}>{st.error ? t.syncErr.network : st.lastSync ? t.lastSync(new Date(st.lastSync).toLocaleTimeString()) : ''}</div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize:'0.78rem', color:C.muted, lineHeight:1.6, marginBottom:8 }}>{t.syncIntro}</p>
              <BtnPrimary onClick={doEnable} disabled={busy} style={{ fontSize:'0.78rem', padding:'0.5rem 1rem', marginBottom:12 }}>{busy ? '…' : t.syncEnable}</BtnPrimary>
              <div style={{ display:'flex', gap:8 }}>
                <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder={t.joinPh} aria-label={t.joinPh}
                  style={{ flex:1, padding:'0.5rem', fontSize:'0.8rem', border:`1px solid ${C.border}`, background:C.card, fontFamily:'monospace' }}/>
                <button type="button" style={btn} onClick={doJoin} disabled={busy || !joinCode.trim()}>{t.join}</button>
              </div>
            </div>
          )}
        </Section>

        <Section title={t.backup} count="">
          <p style={{ fontSize:'0.78rem', color:C.muted, lineHeight:1.6, marginBottom:8 }}>{t.backupNote}</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
            <BtnPrimary onClick={doCopy} style={{ fontSize:'0.78rem', padding:'0.5rem 1rem' }}>{t.copy}</BtnPrimary>
            <button type="button" style={btn} onClick={() => { if (window.confirm(t.confirmClear)) { clearMemory(); refresh(); setMsg(t.cleared) } }}>{t.clear}</button>
          </div>
          <textarea value={code} onChange={e => setCode(e.target.value)} placeholder={t.paste} rows={3} aria-label={t.paste}
            style={{ width:'100%', padding:'0.6rem', fontSize:'0.75rem', border:`1px solid ${C.border}`, background:C.card, fontFamily:'monospace', boxSizing:'border-box' }}/>
          <button type="button" style={{ ...btn, marginTop:6 }} onClick={doImport} disabled={!code.trim()}>{t.restore}</button>
          {msg && <div role="status" style={{ fontSize:'0.78rem', color:C.rust, marginTop:8 }}>{msg}</div>}
        </Section>
      </div>
    </div>
  )
}
