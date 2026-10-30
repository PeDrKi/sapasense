import { useState, useEffect, useLayoutEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { BtnPrimary, BtnSecondary }          from '../components/ui'
const LeafletMap = lazy(() => import('../components/LeafletMap'))
import { gsap, ScrollTrigger, reducedMotion, EASE } from '../utils/motion'
import SafetyNote                         from '../components/SafetyNote'
import PlaceImage                          from '../components/PlaceImage'
import LangToggle                             from '../components/LangToggle'
import { C, MARKER_COLORS }                  from '../styles/tokens'
import { recommend, getBudgetAmount, swapStop, rebuildPlan, effectiveNow, isRainyCode, moveStop, localISO } from '../utils/recommend'
import { noteShown, noteVisited, hidePlace, memoryForAnswers, toggleFav, favIds } from '../utils/memory'
import { encodePlan, directionsUrl, stopDirectionsUrl } from '../utils/share'
import { legInfo, tripSummary, fmtKm, fmtDur, stopState } from '../utils/trip'
import { getPlaces } from '../data/placeStore'
import { downloadICS } from '../utils/ics'
import { postReview } from '../utils/backend'
import { exportPDF }                          from '../utils/exportPDF'
import { SkeletonList, SkeletonResultHeader } from '../components/Skeleton'
import { useT }                               from '../i18n'
import type { Answers, Plan, Stop, Review, Weather, Mode } from '../types'

type StopState = 'now' | 'upcoming' | 'past' | null
interface Accommodation { id: string; img?: string | null; name: string; type: string; area: string; price: string; desc: string; pros: string[]; suitable: boolean }
interface Leg { from: string; to: string; mode: string; duration: string; cost: string; costNum: number; tip: string }
interface StayData { accommodations: Accommodation[]; transport: Leg[]; budgetSummary: { tickets: string; transport: string; total: string } }
interface SharedPlan { ids: string[]; startHour?: number; dateISO?: string }
type R = ReturnType<typeof useT>['result']

const LS_KEY = 'sapasense_reviews'
function loadReviews(): Review[] { try { return JSON.parse(localStorage.getItem(LS_KEY)||'[]') } catch { return [] } }
function saveReview(e: Review) { try { const a=loadReviews(); a.unshift(e); localStorage.setItem(LS_KEY,JSON.stringify(a.slice(0,50))) } catch { /* storage unavailable */ } }

const LS_DONE = 'ss_done'
function loadDone(day: string | undefined): string[] { try { const o = JSON.parse(localStorage.getItem(LS_DONE) || '{}'); return o.day === day ? o.ids : [] } catch { return [] } }
function saveDone(day: string | undefined, ids: string[]) { try { localStorage.setItem(LS_DONE, JSON.stringify({ day, ids })) } catch { /* ignore */ } }

// ── Stop Card ─────────────────────────────────────────
interface StopCardProps { stop: Stop; index: number; total?: number; mode: Mode; r: R; onSwap?: (id: string) => void; onHide?: (id: string) => void; onMove?: (id: string, dir: number) => void; state?: StopState; done?: boolean; onDone?: (id: string) => void; fav?: boolean; onFav?: (id: string) => void }
function StopCard({ stop, index, total, mode, r, onSwap, onHide, onMove, state, done, onDone, fav, onFav }: StopCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (reducedMotion() || !cardRef.current) return
    const el = cardRef.current
    // cards already on screen: staggered entrance; cards below the fold: revealed on scroll
    const tween = gsap.from(el, { y: 36, opacity: 0, duration: 0.6, ease: EASE, delay: Math.min(index, 3) * 0.1,
      scrollTrigger: { trigger: el, start: 'top 94%', once: true } })
    return () => { tween.scrollTrigger?.kill(); tween.kill() }
  }, [])
  const menu = stop.menu ?? []
  const menuSrc = stop.menuSrc ?? []
  return (
    <div ref={cardRef} style={{ background:stop.hiddenGem&&mode==='local'?'rgba(61,92,53,0.06)':C.card, border:`1px solid ${stop.hiddenGem&&mode==='local'?'rgba(61,92,53,0.3)':C.border}`, padding:'0.95rem', display:'flex', gap:'0.85rem', position:'relative' }}>
      {stop.hiddenGem && mode==='local' && (
        <div style={{ position:'absolute', top:8, right:8, fontSize:'0.6rem', background:'#3D5C35', color:'white', padding:'0.15rem 0.5rem', fontWeight:600 }}>{r.hiddenGem}</div>
      )}
      <div style={{ minWidth:30, height:30, flexShrink:0, background:MARKER_COLORS[index%MARKER_COLORS.length], color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.83rem' }}>{index+1}</div>
      <div style={{ flex:1, opacity:done?0.55:1 }}>
        {state && state !== 'past' && <div style={{ marginBottom:4 }}><span style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:state==='now'?'#fff':C.rust, background:state==='now'?C.rust:'transparent', border:state==='now'?'none':`1px solid ${C.rust}`, padding:'0.1rem 0.5rem' }}>{state==='now' ? r.nowBadge : r.nextBadge}</span></div>}
        <PlaceImage place={stop} credit={stop.imgCredit}/>
        <div style={{ fontWeight:600, fontSize:'0.9rem', marginBottom:3, textDecoration:done?'line-through':'none' }}>{stop.name}</div>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6, flexWrap:'wrap' }}>
          <span style={{ fontSize:'0.69rem', color:C.rust, letterSpacing:'0.07em', textTransform:'uppercase' }}>{stop.time}</span>
          {stop.distKm != null && <span style={{ fontSize:'0.67rem', color:C.muted }}>📍 {r.nearYou(stop.distKm)}</span>}
          {stop.displayTime && mode==='local' && (
            <span style={{ fontSize:'0.67rem', color:'#3D5C35' }}>{r.localTime} {stop.displayTime}</span>
          )}
        </div>
        {stop.warn && <div role="note" style={{ fontSize:'0.72rem', color:'#9A5B00', background:'rgba(232,160,32,0.12)', padding:'0.25rem 0.55rem', marginBottom:6, display:'inline-block' }}>{stop.warn==='closed' ? r.warnClosed : stop.warn==='late' ? r.warnLate : r.warnHours}</div>}
        <div style={{ fontSize:'0.81rem', color:C.muted, lineHeight:1.65 }}>{stop.desc}</div>
        {stop.tip && (
          <div style={{ fontSize:'0.75rem', color:C.muted, fontStyle:'italic', marginTop:6, paddingTop:6, borderTop:`1px solid ${C.border}` }}>💡 {stop.tip}</div>
        )}
        {stop.badges?.length > 0 && (
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:7 }}>
            {stop.badges.map((b,j) => { const pr = /^(TB menu|TB ~|Ước tính)/.test(b); const good = /^TB menu/.test(b); return <span key={j} style={{ fontSize:'0.68rem', padding:'0.12rem 0.5rem', fontWeight:pr?600:400, background:pr?(good?'rgba(61,92,53,.12)':'rgba(232,160,32,.16)'):'rgba(26,25,22,.05)', color:pr?(good?'#2F4A29':'#7A4A00'):C.muted }}>{b}</span> })}
          </div>
        )}
        {stop.priceQuality && (
          <div style={{ marginTop:6 }}>
            {menu.length > 0 && (
              <button type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)} style={{ fontSize:'0.72rem', color:C.rust, background:'none', border:'none', padding:0, cursor:'pointer', textDecoration:'underline', fontFamily:"'Be Vietnam Pro',sans-serif" }}>{menuOpen ? r.menuHide : r.menuShow}</button>
            )}
            {stop.priceQuality !== 'menu' && <div style={{ fontSize:'0.68rem', color:'#9A5B00', marginTop:3 }}>{stop.priceQuality === 'est' ? r.menuEst : r.menuPartial}</div>}
            {menuOpen && menu.length > 0 && (
              <div style={{ marginTop:6, padding:'0.5rem 0.65rem', background:'rgba(26,25,22,.04)', fontSize:'0.73rem', color:C.muted }}>
                <ul style={{ listStyle:'none', margin:0, padding:0 }}>
                  {menu.map((it, j) => <li key={j} style={{ display:'flex', justifyContent:'space-between', gap:10, padding:'1px 0' }}><span>{it.n}</span><span style={{ whiteSpace:'nowrap' }}>{Number(it.p).toLocaleString('vi-VN')}đ</span></li>)}
                </ul>
                <div style={{ marginTop:5, fontStyle:'italic' }}>{r.menuAvgNote}{stop.menuNote ? ' ' + stop.menuNote : ''} {stop.menuChecked ? r.menuChecked(stop.menuChecked) : ''}</div>
                {menuSrc.length > 0 && <div style={{ marginTop:3, display:'flex', flexWrap:'wrap', gap:8 }}>{menuSrc.map((u, j) => { let h = u; try { h = new URL(u).hostname.replace(/^www\./, '') } catch { /* keep */ } return <a key={j} href={u} target="_blank" rel="noopener noreferrer" style={{ color:C.rust }}>{h}</a> })}</div>}
              </div>
            )}
          </div>
        )}
        {stop.why?.length > 0 && (
          <div aria-label={r.whyLabel} style={{ marginTop:7, fontSize:'0.7rem', color:'#3D5C35', lineHeight:1.6 }}>
            {stop.why.filter(w => !(w.k === 'free' && stop.badges?.some(b => /miễn phí|free/i.test(b)))).map(w => { const key = 'why'+w.k.charAt(0).toUpperCase()+w.k.slice(1); const rv = (r as any)[key]; return typeof rv === 'function' ? rv(w.v) : rv }).filter(Boolean).map(t => '✓ ' + t).join('   ')}
          </div>
        )}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:9 }}>
          {onDone && <button type="button" aria-pressed={!!done} onClick={() => onDone(stop.id)} style={{ fontSize:'0.72rem', color:done?'#fff':'#3D5C35', background:done?'#3D5C35':'none', border:'1px solid #3D5C35', padding:'0.25rem 0.65rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif" }}>{done ? r.doneUndo : r.doneBtn}</button>}
          {onFav && <button type="button" aria-pressed={!!fav} onClick={() => onFav(stop.id)} style={{ fontSize:'0.72rem', color:fav?'#B02A2A':C.muted, background:'none', border:`1px solid ${fav?'#B02A2A':C.border}`, padding:'0.25rem 0.65rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif" }}>{fav ? r.favOn : r.favAdd}</button>}
          <a href={stopDirectionsUrl(stop)} target="_blank" rel="noopener noreferrer" style={{ fontSize:'0.72rem', color:C.rust, textDecoration:'none', border:`1px solid ${C.border}`, padding:'0.25rem 0.65rem' }}>{r.directions}</a>
        </div>
        {(onMove || onSwap) && (
          <div style={{ display:'flex', gap:2, flexWrap:'wrap', marginTop:6, marginLeft:-6 }}>
            {onMove && <>
              <button type="button" aria-label={r.moveUp} title={r.moveUp} disabled={index===0} onClick={() => onMove(stop.id, -1)} style={{ fontSize:'0.78rem', color:C.muted, background:'none', border:'none', padding:'0.2rem 0.5rem', cursor:index===0?'not-allowed':'pointer', opacity:index===0?.3:1 }}>↑</button>
              <button type="button" aria-label={r.moveDown} title={r.moveDown} disabled={index===(total ?? 1)-1} onClick={() => onMove(stop.id, 1)} style={{ fontSize:'0.78rem', color:C.muted, background:'none', border:'none', padding:'0.2rem 0.5rem', cursor:index===(total ?? 1)-1?'not-allowed':'pointer', opacity:index===(total ?? 1)-1?.3:1 }}>↓</button>
            </>}
            {onSwap && <button type="button" onClick={() => onSwap(stop.id)} style={{ fontSize:'0.72rem', color:C.muted, background:'none', border:'none', padding:'0.2rem 0.5rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif", textDecoration:'underline' }}>{r.swapStop}</button>}
            {onHide && <button type="button" onClick={() => onHide(stop.id)} title={r.hideTitle} style={{ fontSize:'0.72rem', color:C.muted, background:'none', border:'none', padding:'0.2rem 0.5rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif", textDecoration:'underline' }}>{r.hideStop}</button>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Star Row ──────────────────────────────────────────
function StarRow({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="star-row" style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:'0.35rem 0.75rem', marginBottom:'0.9rem' }}>
      <span style={{ fontSize:'0.82rem', color:C.ink, minWidth:200, flex:'1 1 200px' }}>{label}</span>
      <div style={{ display:'flex', gap:4 }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" aria-label={`${label}: ${n}/5`} aria-pressed={n<=value} onClick={() => onChange(n)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.3rem', lineHeight:1, color:n<=value?'#E8A020':C.border, transition:'color 0.15s', transform:n<=value?'scale(1.12)':'scale(1)' }}>★</button>
        ))}
      </div>
    </div>
  )
}

// ── Main Screen ───────────────────────────────────────
interface Props { answers: Answers; wx: Weather | null; onRestart: () => void; onAdjust: (patch: Partial<Answers>) => void; shared?: SharedPlan | null }

export default function ResultScreen({ answers, wx, onRestart, onAdjust, shared }: Props) {
  const t = useT()
  const r = t.result

  const [status,    setStatus]    = useState<'loading' | 'done' | 'error'>('loading')
  const [result,    setResult]    = useState<Plan | null>(null)
  const [errMsg,    setErrMsg]    = useState('')
  const [exporting, setExporting] = useState(false)
  const [tab,       setTab]       = useState('list')
  const [rejected,  setRejected]  = useState<string[]>([])
  const [notice,    setNotice]    = useState('')
  const [copied,    setCopied]    = useState(false)
  const sharedRef = useRef<SharedPlan | null>(shared || null)
  const seedRef   = useRef(0)
  const [favs, setFavs] = useState(favIds)
  useEffect(() => { const f = () => setFavs(favIds()); window.addEventListener('ss-memory-synced', f); return () => window.removeEventListener('ss-memory-synced', f) }, [])
  const handleFav = (id: string) => { toggleFav(id); setFavs(favIds()) }
  const withMemory = (a: Answers): Answers => ({ ...a, seed: seedRef.current, ...memoryForAnswers(localISO(new Date())) })
  const [doneIds, setDoneIds] = useState<string[]>([])

  const [compareResult, setCompareResult] = useState<Plan | null>(null)
  const [compareStatus, setCompareStatus] = useState('idle')
  const [showCompare,   setShowCompare]   = useState(false)

  const [stayStatus, setStayStatus] = useState('idle')
  const [stayData,   setStayData]   = useState<StayData | null>(null)

  const BLANK = { overall:0, relevance:0, accuracy:0, usability:0 }
  const [ratings,     setRatings]     = useState(BLANK)
  const [comment,     setComment]     = useState('')
  const [submitted,   setSubmitted]   = useState(false)
  const [pastReviews, setPastReviews] = useState<Review[]>([])

  useEffect(() => { setPastReviews(loadReviews()) }, [])

  // Derived labels
  const moodLabel   = t.moods[answers.mood]?.label    || ''
  const timeLabel   = t.times[answers.time]?.label    || ''
  const groupLabel  = answers.group === 'any' ? '' : (t.groups[answers.group]?.label  || '')
  const budgetLabel = t.budgetsFull[answers.budget-1] || ''

  const now  = effectiveNow(answers)
  const hour = now.getHours()
  const tod  = hour<11?t.tod.morning:hour<14?t.tod.noon:hour<18?t.tod.afternoon:t.tod.evening
  const dow  = t.dow[now.getDay()]
  const wxStr = wx ? `${wx.label}, ${wx.temp}°C` : 'Sa Pa'

  // Generate itinerary
  const generate = useCallback(() => {
    setStatus('loading'); setResult(null)
    setStayStatus('idle'); setStayData(null)
    setSubmitted(false); setRatings(BLANK); setComment('')
    setShowCompare(false); setCompareResult(null); setCompareStatus('idle')
    try {
      setRejected([])
      let out: Plan
      if (sharedRef.current) {
        out = rebuildPlan({ answers, wx, ...sharedRef.current })
        sharedRef.current = null
      } else {
        out = recommend({ answers: withMemory(answers), wx })
      }
      setResult(out); setStatus('done')
      if (out.stops?.length) noteShown(out.stops.map(x => x.id), out.dateISO)
      fetchStay(out.stops || [])
    } catch(err) {
      setErrMsg((err as Error).message); setStatus('error')
    }
  }, [answers, wx])

  // regenerate only when the answers change or rain starts/stops — not on every weather refresh
  const rainy = isRainyCode(wx?.code ?? 0)
  useEffect(() => { generate() }, [answers, rainy])

  // A/B compare
  const generateCompare = useCallback(() => {
    setCompareStatus('loading'); setShowCompare(true)
    try {
      const opposite = (answers.mode||'tourist') === 'tourist' ? 'local' : 'tourist'
      const out = recommend({ answers:{ ...answers, mode:opposite }, wx })
      setCompareResult(out); setCompareStatus('done')
    } catch { setCompareStatus('error') }
  }, [answers, wx])

  // Static accommodation
  const fetchStay = (stops: Stop[]) => {
    setStayStatus('loading')
    const budgetAmt = getBudgetAmount(answers.budget)
    // Lưu trú lấy từ danh sách địa điểm (type 'lodging', mã NN***): giá/đêm nằm ở badge đầu tiên, hạng ở badge thứ hai.
    const lodging = getPlaces().filter(p => p.type === 'lodging')
    const affordable = lodging.filter(p => p.cost <= budgetAmt).sort((x, y) => y.cost - x.cost)
    const pick = (affordable.length ? affordable : [...lodging].sort((x, y) => x.cost - y.cost)).slice(0, 3)
    const filtered: Accommodation[] = pick.map(p => {
      // Nếu badge đầu là giá ("700k–1,2tr/đêm") thì dùng như cũ; không thì lấy giá từ trường cost.
      const hasPrice = /\d/.test(p.badges[0] || '') && /đêm|\//.test(p.badges[0] || '')
      const b = hasPrice ? p.badges : [`${p.cost >= 1_000_000 ? (p.cost / 1_000_000).toString().replace('.', ',') + 'tr' : Math.round(p.cost / 1000) + 'k'}/đêm`, ...p.badges]
      return {
        id: p.id, img: p.img, name: p.name, type: b[1] || 'Lưu trú', area: p.area, price: b[0], desc: p.desc,
        pros: b.slice(2).filter(x => x !== 'Trong nhà'), suitable: p.cost <= budgetAmt,
      }
    })

    const transport = stops.slice(0,stops.length-1).map((stop,i) => {
      const next = stops[i+1]
      const dist = Math.sqrt(Math.pow((stop.lat-next.lat)*111,2)+Math.pow((stop.lng-next.lng)*111,2))
      if (dist < 0.5) return { from:stop.name, to:next.name, mode:'Đi bộ', duration:`~${Math.max(3, Math.round(dist/4.5*60))} phút`, cost:'Miễn phí', costNum:0, tip:'Rất gần nhau, đi bộ thoải mái.' }
      if (dist < 2)   return { from:stop.name, to:next.name, mode:'Đi bộ / xe ôm', duration:'10-20 phút', cost:'~20-40K', costNum:30000, tip:'Đường dốc, trời sương nên đi xe thay vì đi bộ.' }
      if (dist < 5)   return { from:stop.name, to:next.name, mode:'Xe ôm / taxi', duration:'15-25 phút', cost:'~40-80K', costNum:60000, tip:'Hỏi giá trước khi đi.' }
      return { from:stop.name, to:next.name, mode:'Taxi / xe máy thuê', duration:'30-60 phút', cost:'~100-250K', costNum:150000, tip:'Đường đèo dốc, đi chậm; tránh đi đèo khi sương dày hoặc mưa.' }
    })

    setStayData({
      accommodations: filtered,
      transport,
      budgetSummary: (() => {
        const tickets = stops.reduce((a, st) => a + (st.cost || 0), 0)
        const move    = transport.reduce((a, l) => a + (l.costNum || 0), 0)
        const money   = (n: number) => n === 0 ? 'Miễn phí' : `~${n.toLocaleString('vi-VN')}đ`
        return { tickets: money(tickets), transport: money(move), total: money(tickets + move) }
      })()
    })
    setStayStatus('done')
  }

  const handleSwap = (stopId: string) => {
    if (!result) return
    const out = swapStop({ answers: withMemory(answers), wx, result, stopId, exclude: rejected })
    if (!out) { setNotice(r.swapNone); setTimeout(() => setNotice(''), 3000); return }
    setRejected(rj => [...rj, stopId])
    setResult(out)
    fetchStay(out.stops)
  }

  const handleHide = (stopId: string) => { hidePlace(stopId); handleSwap(stopId); setNotice(r.hiddenNote); setTimeout(() => setNotice(''), 3500) }
  const regen = () => { seedRef.current += 1; generate() }

  const dayKey = result?.dateISO
  useEffect(() => { if (dayKey) setDoneIds(loadDone(dayKey)) }, [dayKey])
  const toggleDone = (id: string) => setDoneIds(prev => {
    const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    saveDone(dayKey, next); noteVisited(id, next.includes(id)); return next
  })
  const isToday = dayKey === new Date().toLocaleDateString('sv-SE')
  const nowHour = new Date().getHours() + new Date().getMinutes() / 60
  const states = (result?.stops || []).map(stp => isToday ? stopState(stp, nowHour) : null)
  const firstUpcoming = states.indexOf('upcoming')
  const stateOf = (i: number): StopState => states[i] === 'now' ? 'now' : (i === firstUpcoming && !states.includes('now')) ? 'upcoming' : states[i] === 'past' ? 'past' : null

  const wantStops = ({ '2h':2, half:3, full:5 })[answers.time] || 3
  const summary = result?.stops?.length ? tripSummary(result.stops) : null

  const handleMove = (stopId: string, dir: number) => {
    if (!result) return
    const out = moveStop({ answers, wx, result, stopId, dir })
    setResult(out)
    fetchStay(out.stops)
  }

  const handleShare = async () => {
    const url = window.location.href
    try { await navigator.clipboard.writeText(url) }
    catch { window.prompt('Link:', url) }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  // keep the address bar a shareable link to exactly this plan
  useEffect(() => {
    if (!result?.stops?.length) return
    try { window.history.replaceState(null, '', '#p=' + encodePlan({ answers, result })) } catch { /* ignore */ }
  }, [result, answers])

  const handleExport = async () => {
    if (!result) return
    setExporting(true)
    try { await exportPDF(result, answers, wx, window.location.href) }
    catch(e) { alert('Lỗi export: '+(e as Error).message) }
    finally   { setExporting(false) }
  }

  const submitReview = () => {
    if (ratings.overall === 0) return
    const entry: Review = { date:now.toLocaleString('vi-VN'), mood:answers.mood, timeLabel, groupLabel, budgetLabel, ratings:{ ...ratings }, comment:comment.trim(), stops:result?.stops?.map(s=>s.name)||[] }
    saveReview(entry)
    postReview(entry)   // also stored in the shared database when the API is configured
    // Optional: also send to a shared endpoint (Google Apps Script, Formspree, …) so reviews from many people can be collected
    const endpoint = import.meta.env.VITE_REVIEW_ENDPOINT
    if (endpoint) {
      try { fetch(endpoint, { method:'POST', mode:'no-cors', headers:{ 'Content-Type':'text/plain' }, body:JSON.stringify(entry) }).catch(() => {}) } catch { /* ignore */ }
    }
    setPastReviews(loadReviews())
    setSubmitted(true)
  }

  const avgStat = (key: string): string | number => pastReviews.length
    ? (pastReviews.reduce((s,rv)=>s+(rv.ratings?.[key]||0),0)/pastReviews.length).toFixed(1) : 0

  const tabs = [
    { id:'list',   label:r.tabList },
    { id:'map',    label:r.tabMap  },
    { id:'stay',   label:answers.time==='full' ? r.tabStay : r.tabMove },
    { id:'review', label:r.tabReview },
  ]

  const moodShort = moodLabel.split('&')[0].trim()

  return (
    <div style={{ minHeight:'100vh', background:C.cream, display:'flex', flexDirection:'column', position:'relative' }}>

      {/* HEADER */}
      {status === 'loading' ? <SkeletonResultHeader/> : (
        <div className="result-header" style={{ position:'relative', zIndex:1, padding:'1.4rem 1.75rem 1.1rem', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'1rem' }}>
          <div style={{ flex:1 }}>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(1.1rem,3vw,1.4rem)', lineHeight:1.2, marginBottom:4 }}>
              {r.titlePre}{moodShort}{r.titlePost}
            </h1>
            <p style={{ fontSize:'0.74rem', color:C.muted, marginBottom:9 }}>
              {dow} · {tod} · {wx ? `${wx.icon} ${wx.temp}°C · ${wx.label}` : 'Sa Pa'}
            </p>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
              {[moodLabel, timeLabel, groupLabel, budgetLabel, ...(answers.loc ? ['📍 ' + (answers.loc.label || r.nearChip)] : []), ...(answers.focus==='food' ? [r.focusChipFood] : answers.focus==='cafe' ? [r.focusChipCafe] : [])].filter(Boolean).map((lbl, i) => (
                <span key={i} style={{ fontSize:'0.67rem', letterSpacing:'0.09em', textTransform:'uppercase', border:`1px solid ${i===0?C.rust:C.border}`, padding:'0.17rem 0.65rem', color:i===0?C.rust:C.muted }}>{lbl}</span>
              ))}
              <span style={{ fontSize:'0.67rem', letterSpacing:'0.08em', textTransform:'uppercase', padding:'0.17rem 0.65rem', fontWeight:600, background:answers.mode==='local'?'#3D5C35':'#2A7BA8', color:'white' }}>
                {answers.mode === 'local' ? r.modeLocal : r.modeTourist}
              </span>
            </div>
          </div>
          <div className="result-btns" style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
            <LangToggle/>
            {status === 'done' && result && (
              <BtnPrimary onClick={handleExport} disabled={exporting} style={{ fontSize:'0.77rem', padding:'0.52rem 1rem' }}>
                {exporting ? r.exporting : r.pdf}
              </BtnPrimary>
            )}
            <BtnSecondary onClick={onRestart} style={{ fontSize:'0.77rem', padding:'0.52rem 0.9rem' }}>{r.restart}</BtnSecondary>
          </div>
        </div>
      )}

      {/* BODY */}
      <div style={{ position:'relative', zIndex:1, flex:1, padding:'1.4rem 1.75rem' }}>

        {status === 'loading' && (
          <SkeletonList count={answers.time==='2h'?3:answers.time==='half'?5:7}/>
        )}

        {status === 'error' && (
          <div>
            <div style={{ padding:'1rem', border:'1px solid rgba(184,92,42,.3)', background:C.rustLight, color:C.rust, fontSize:'0.83rem', lineHeight:1.65, marginBottom:'1.2rem' }}>
              {r.error}<br/><small style={{ opacity:.7 }}>{errMsg}</small>
            </div>
            <BtnPrimary onClick={generate}>{r.retry}</BtnPrimary>
          </div>
        )}

        {status === 'done' && result && (
          <div>
            {result.startsTomorrow && (
              <div role="status" style={{ background:'rgba(232,160,32,0.12)', border:'1px solid rgba(232,160,32,0.4)', padding:'0.6rem 0.9rem', fontSize:'0.8rem', color:C.ink, marginBottom:'0.9rem' }}>🌙 {r.startsTomorrow}</div>
            )}
            {result.narrative && (
              <div style={{ borderLeft:`2px solid ${C.rust}`, paddingLeft:'1rem', marginBottom:'1.4rem', fontFamily:"'Playfair Display',serif", fontStyle:'italic', fontSize:'0.92rem', color:C.muted, lineHeight:1.8 }}>
                {result.narrative}
              </div>
            )}

            {/* TAB BAR */}
            <div className="tab-bar" style={{ display:'flex', borderBottom:`1px solid ${C.border}`, marginBottom:'1.25rem' }}>
              {tabs.map(tb => (
                <button key={tb.id} onClick={() => setTab(tb.id)} style={{ padding:'0.6rem 0.95rem', fontSize:'0.79rem', fontFamily:"'Be Vietnam Pro',sans-serif", background:'none', border:'none', cursor:'pointer', marginBottom:-1, whiteSpace:'nowrap', borderBottom:`2px solid ${tab===tb.id?C.rust:'transparent'}`, color:tab===tb.id?C.rust:C.muted, fontWeight:tab===tb.id?600:400, transition:'all 0.18s' }}>
                  {tb.label}
                  {tb.id==='stay'   && stayStatus==='loading' && <span style={{ marginLeft:4, opacity:.5, fontSize:'0.6rem' }}>●</span>}
                  {tb.id==='stay'   && stayStatus==='done'    && <span style={{ marginLeft:4, color:C.sage, fontSize:'0.6rem' }}>✓</span>}
                  {tb.id==='review' && submitted               && <span style={{ marginLeft:4, color:C.sage, fontSize:'0.6rem' }}>✓</span>}
                </button>
              ))}
              <div className="tab-spacer" style={{ flex:1 }}/>
              <button className="tab-regen" onClick={regen} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.75rem', color:C.muted, padding:'0.6rem 0', fontFamily:"'Be Vietnam Pro',sans-serif" }}>{r.regen}</button>
            </div>

            {/* LIST TAB */}
            {tab === 'list' && (
              <>
            {onAdjust && status === 'done' && (
              <div style={{ marginBottom:'1.1rem' }}>
                {answers.auto && answers.why && <div style={{ fontSize:'0.74rem', color:C.muted, marginBottom:6 }}>{r.autoBasis} {answers.why.map(k => (r.autoWhy as Record<string, string>)[k]).filter(Boolean).join(', ')}</div>}
                <div role="group" aria-label={r.tweakLabel} style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                  {(Object.entries(t.moods) as [Answers['mood'], { label: string; desc: string }][]).map(([id, m]) => { const on = answers.mood === id; return <button key={id} type="button" aria-pressed={on} onClick={() => onAdjust({ mood:id })} style={{ fontSize:'0.74rem', padding:'0.3rem 0.7rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif", background:on?C.rustLight:'none', color:on?C.rust:C.ink, border:`1px solid ${on?C.rust:C.border}` }}>{m.label.split('&')[0].trim()}</button> })}
                  {(getPlaces().some(p => p.type === 'cafe') ? ['all','food','cafe'] as const : ['all','food'] as const).map(id => { const on = (answers.focus || 'all') === id; const lb = id === 'all' ? t.onboard.focusAll : id === 'food' ? t.onboard.focusFood : t.onboard.focusCafe; return <button key={id} type="button" aria-pressed={on} onClick={() => onAdjust({ focus:id })} style={{ fontSize:'0.74rem', padding:'0.3rem 0.7rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif", background:on?C.ink:'none', color:on?C.cream:C.ink, border:`1px solid ${on?C.ink:C.border}` }}>{lb}</button> })}
                  {(['2h','half','full'] as const).map(id => { const on = answers.time === id; return <button key={id} type="button" aria-pressed={on} onClick={() => onAdjust({ time:id })} style={{ fontSize:'0.74rem', padding:'0.3rem 0.7rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif", background:on?C.ink:'none', color:on?C.cream:C.ink, border:`1px solid ${on?C.ink:C.border}` }}>{t.times[id].label.split('—')[0].trim()}</button> })}
                </div>
              </div>
            )}
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                <div style={{ background:answers.mode==='local'?'rgba(61,92,53,0.08)':C.sageLight, border:'1px solid rgba(61,92,53,.2)', padding:'0.65rem 1rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem', fontSize:'0.77rem' }}>
                  <span style={{ color:C.sage }}>{answers.mode==='local' ? r.hintLocal : r.hintTourist}</span>
                  {!showCompare && (
                    <button onClick={generateCompare} style={{ background:'none', border:`1px solid ${C.border}`, padding:'0.25rem 0.7rem', fontSize:'0.7rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif", color:C.muted, whiteSpace:'nowrap', flexShrink:0 }}>
                      {r.abBtn}
                    </button>
                  )}
                </div>
                <div className="act-bar" style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                  <a href={directionsUrl(result.stops)} target="_blank" rel="noopener noreferrer" style={{ fontSize:'0.76rem', color:C.cream, background:C.ink, textDecoration:'none', padding:'0.45rem 0.9rem' }}>{r.openRoute}</a>
                  <button type="button" onClick={handleShare} style={{ fontSize:'0.76rem', color:C.ink, background:'none', border:`1px solid ${C.border}`, padding:'0.45rem 0.9rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif" }}>{copied ? r.copied : r.copyLink}</button>
                  {result?.stops?.length ? <button type="button" onClick={() => downloadICS(result)} style={{ fontSize:'0.76rem', color:C.ink, background:'none', border:`1px solid ${C.border}`, padding:'0.45rem 0.9rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif" }}>{r.addCal}</button> : null}
                  {notice && <span role="status" style={{ fontSize:'0.76rem', color:C.rust }}>{notice}</span>}
                </div>
                {(!isRainyCode(wx?.code ?? 0) || [95, 96, 99].includes(wx?.code ?? 0)) && <SafetyNote wx={wx}/>}
                {isRainyCode(wx?.code ?? 0) && <div role="status" style={{ background:'rgba(42,123,168,0.1)', border:'1px solid rgba(42,123,168,0.3)', padding:'0.55rem 0.85rem', fontSize:'0.78rem', color:'#1F5F85' }}>{r.rainBanner}</div>}
                {Number(wx?.temp) >= 35 && <div role="status" style={{ background:'rgba(232,160,32,0.12)', border:'1px solid rgba(232,160,32,0.4)', padding:'0.55rem 0.85rem', fontSize:'0.78rem', color:'#7A4A00' }}>{r.hotBanner(wx?.temp ?? '')}</div>}
                {result.stops.length < wantStops && (
                  <div role="status" style={{ background:C.rustLight, border:`1px solid ${C.border}`, padding:'0.6rem 0.85rem', fontSize:'0.78rem', color:C.ink, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ flex:'1 1 220px' }}>{r.fewStops(result.stops.length, wantStops)}</span>
                    <button type="button" onClick={onRestart} style={{ background:C.ink, color:C.cream, border:'none', padding:'0.4rem 0.9rem', cursor:'pointer', fontSize:'0.75rem', fontFamily:"'Be Vietnam Pro',sans-serif" }}>{r.fewStopsBtn}</button>
                  </div>
                )}
                {summary && (
                  <div style={{ display:'flex', gap:'0.4rem 1.1rem', flexWrap:'wrap', fontSize:'0.78rem', color:C.muted, padding:'0.1rem 0' }}>
                    <strong style={{ color:C.ink }}>{r.sumStops(summary.count)}</strong>
                    <span>⏱ {fmtDur(summary.span)} {r.sumSpan}</span>
                    {summary.km > 0 && <span>↔ {fmtKm(summary.km)} · ~{fmtDur(summary.move)} {r.sumMove}</span>}
                    <span>🎟 {summary.tickets ? `${summary.tickets.toLocaleString('vi-VN')}đ ${(result?.stops || []).every(x => x.type==='food' || x.type==='cafe') ? r.sumFood : r.sumTickets}` : r.whyFree}</span>
                  </div>
                )}
                {result.stops?.map((stop,i) => (
                  <div key={stop.id||i}>
                    <StopCard stop={stop} index={i} mode={answers.mode || 'tourist'} r={r} total={result.stops.length} state={stateOf(i)} done={doneIds.includes(stop.id)} onDone={isToday ? toggleDone : undefined} onSwap={result.stops.length > 1 ? handleSwap : undefined} onHide={result.stops.length > 1 ? handleHide : undefined} fav={favs.includes(stop.id)} onFav={handleFav} onMove={result.stops.length > 1 ? handleMove : undefined}/>
                    {i < result.stops.length - 1 && (() => { const l = legInfo(stop, result.stops[i+1]); return (
                      <div aria-hidden="true" style={{ display:'flex', alignItems:'center', gap:8, margin:'0.45rem 0 0.1rem 0.85rem', fontSize:'0.7rem', color:C.muted }}>
                        <span style={{ width:1, height:18, background:C.border, display:'inline-block', marginLeft:14 }}/>
                        <span>{l.mode==='walk' ? '🚶' : '🛵'} ~{l.minutes} phút · {fmtKm(l.km)} · {l.mode==='walk' ? r.legWalk : r.legRide}</span>
                      </div>) })()}
                  </div>
                ))}

                {/* A/B PANEL */}
                {showCompare && (
                  <div style={{ marginTop:'0.5rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', margin:'0.5rem 0 1rem' }}>
                      <div style={{ flex:1, height:1, background:C.border }}/>
                      <div style={{ fontSize:'0.72rem', letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                        <span style={{ background:C.ink, color:C.cream, padding:'0.15rem 0.5rem', fontSize:'0.65rem' }}>A</span>
                        {answers.mode==='local'?r.modeLocal:r.modeTourist}
                        <span style={{ color:C.border }}>vs</span>
                        <span style={{ background:C.rust, color:'white', padding:'0.15rem 0.5rem', fontSize:'0.65rem' }}>B</span>
                        {answers.mode==='local'?r.modeTourist:r.modeLocal}
                      </div>
                      <div style={{ flex:1, height:1, background:C.border }}/>
                      <button onClick={() => { setShowCompare(false); setCompareResult(null); setCompareStatus('idle') }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.72rem', color:C.muted, fontFamily:"'Be Vietnam Pro',sans-serif" }}>{r.abClose}</button>
                    </div>
                    {compareStatus === 'loading' && (
                      <div style={{ padding:'1.5rem 0', textAlign:'center', color:C.muted, fontStyle:'italic', fontSize:'0.85rem' }}>{r.abLoading}</div>
                    )}
                    {compareStatus === 'done' && compareResult && (
                      <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                        {compareResult.narrative && (
                          <div style={{ borderLeft:`2px solid ${C.rust}`, paddingLeft:'1rem', marginBottom:'0.5rem', fontFamily:"'Playfair Display',serif", fontStyle:'italic', fontSize:'0.88rem', color:C.muted, lineHeight:1.7 }}>{compareResult.narrative}</div>
                        )}
                        {compareResult.stops?.map((stop,i) => (
                          <StopCard key={i} stop={stop} index={i} mode={answers.mode==='local'?'tourist':'local'} r={r}/>
                        ))}
                        <div className="ab-summary-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem', marginTop:'0.5rem', background:C.card, border:`1px solid ${C.border}`, padding:'0.9rem' }}>
                          {[
                            { label:`A — ${answers.mode==='local'?r.modeLocal:r.modeTourist}`, stops:result.stops,         color:C.ink  },
                            { label:`B — ${answers.mode==='local'?r.modeTourist:r.modeLocal}`,  stops:compareResult.stops,  color:C.rust },
                          ].map(({ label, stops, color }) => {
                            const total = stops?.reduce((s,p) => s+(p.cost||0), 0)||0
                            return (
                              <div key={label}>
                                <div style={{ fontSize:'0.7rem', fontWeight:600, color, marginBottom:8 }}>{label}</div>
                                <div style={{ fontSize:'0.78rem', color:C.muted, marginBottom:4 }}>📍 {stops?.length} điểm dừng</div>
                                <div style={{ fontSize:'0.78rem', color:C.muted, marginBottom:4 }}>💵 {total===0?'Miễn phí':`~${total.toLocaleString('vi-VN')}đ`}</div>
                                <div style={{ fontSize:'0.78rem', color:C.muted }}>
                                  {stops?.filter(s=>s.hiddenGem).length>0 ? `💎 ${stops.filter(s=>s.hiddenGem).length} hidden gem` : '✓ Địa điểm quen thuộc'}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              </>
            )}

            {/* MAP TAB */}
            {tab === 'map' && (
              <div>
                <Suspense fallback={<div className="skeleton" style={{ height:380 }}/>}><LeafletMap stops={result.stops||[]}/></Suspense>
                <div style={{ marginTop:'1rem', padding:'1rem', background:C.card, border:`1px solid ${C.border}`, display:'flex', flexDirection:'column', gap:7 }}>
                  <p style={{ fontSize:'0.72rem', color:C.muted, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:2 }}>Chú thích điểm dừng</p>
                  {result.stops?.map((s,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
                      <div style={{ width:18, height:18, borderRadius:'50%', flexShrink:0, background:MARKER_COLORS[i%MARKER_COLORS.length], display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'0.6rem', fontWeight:700 }}>{i+1}</div>
                      <span style={{ fontSize:'0.82rem', fontWeight:500, color:C.ink }}>{s.name}</span>
                      <span style={{ fontSize:'0.72rem', color:C.muted }}>— {s.time}</span>
                      {s.lat&&s.lng&&<span style={{ marginLeft:'auto', fontSize:'0.63rem', color:C.muted, fontFamily:'monospace', opacity:.6 }}>{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STAY TAB */}
            {tab === 'stay' && (
              <div>
                {stayStatus==='loading' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                    {[0,1,2].map(i => (
                      <div key={i} className="skeleton" style={{ height:100, borderRadius:2, animationDelay:`${i*0.1}s` }}/>
                    ))}
                  </div>
                )}
                {stayStatus==='error' && <div style={{ padding:'1rem', background:C.rustLight, color:C.rust, fontSize:'0.83rem' }}>{r.stayError}</div>}
                {stayStatus==='done' && stayData && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
                    {stayData.budgetSummary && (
                      <div className="budget-summary-grid" style={{ background:C.sageLight, border:'1px solid rgba(61,92,53,.2)', padding:'0.9rem 1.1rem', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.5rem' }}>
                        {[{l:r.budgetTickets,v:stayData.budgetSummary.tickets},{l:r.budgetTrans,v:stayData.budgetSummary.transport},{l:r.budgetTotal,v:stayData.budgetSummary.total}].map(({l,v}) => (
                          <div key={l} style={{ textAlign:'center' }}>
                            <div style={{ fontSize:'0.7rem', color:C.muted, marginBottom:3 }}>{l}</div>
                            <div style={{ fontWeight:600, fontSize:'0.88rem', color:C.sage }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {answers.time === 'full' && (
                    <div>
                      <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.1rem', marginBottom:'0.85rem' }}>{r.accommTitle}</h3>
                      <p style={{ fontSize:'0.72rem', color:C.muted, margin:'-0.5rem 0 0.75rem' }}>{r.priceNote}</p>
                      <div style={{ display:'flex', flexDirection:'column', gap:'0.7rem' }}>
                        {stayData.accommodations?.map((acc,i) => (
                          <div key={i} style={{ background:acc.suitable?'rgba(61,92,53,0.06)':C.card, border:`1px solid ${acc.suitable?'rgba(61,92,53,0.3)':C.border}`, padding:'0.9rem 1rem', position:'relative', animation:`fadeUp 0.38s ease ${i*0.08}s both` }}>
                            {acc.suitable && <div style={{ position:'absolute', top:10, right:10, fontSize:'0.62rem', background:C.sage, color:'white', padding:'0.15rem 0.5rem', fontWeight:600 }}>{r.bestChoice}</div>}
                            <PlaceImage place={{ id: acc.id, name: acc.name, img: acc.img }} height={120}/>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                              <div>
                                <div style={{ fontWeight:600, fontSize:'0.9rem' }}>{acc.name}</div>
                                <div style={{ fontSize:'0.72rem', color:C.muted, marginTop:2 }}>{acc.type} · {acc.area}</div>
                              </div>
                              <div style={{ fontWeight:600, fontSize:'0.85rem', color:C.rust, flexShrink:0, marginLeft:8 }}>{acc.price}</div>
                            </div>
                            <div style={{ fontSize:'0.81rem', color:C.muted, lineHeight:1.6, marginBottom:6 }}>{acc.desc}</div>
                            {acc.pros?.length>0 && (
                              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                                {acc.pros.map((p,j) => <span key={j} style={{ fontSize:'0.66rem', padding:'0.1rem 0.48rem', background:'rgba(61,92,53,0.08)', color:C.sage }}>✓ {p}</span>)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    )}
                    <div>
                      <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.1rem', marginBottom:'0.85rem' }}>{r.transTitle}</h3>
                      <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                        {stayData.transport?.map((leg,i) => (
                          <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, padding:'0.8rem 1rem', animation:`fadeUp 0.38s ease ${i*0.07}s both` }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                              <span style={{ fontSize:'0.8rem', fontWeight:500, color:C.ink, flex:1 }}>{leg.from}</span>
                              <span style={{ fontSize:'0.75rem', color:C.muted }}>→</span>
                              <span style={{ fontSize:'0.8rem', fontWeight:500, color:C.ink, flex:1, textAlign:'right' }}>{leg.to}</span>
                            </div>
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:leg.tip?6:0 }}>
                              {[{icon:'🚗',v:leg.mode},{icon:'⏱',v:leg.duration},{icon:'💵',v:leg.cost}].map(({icon,v}) => (
                                <span key={icon} style={{ fontSize:'0.72rem', padding:'0.15rem 0.55rem', background:'rgba(26,25,22,0.05)', color:C.muted }}>{icon} {v}</span>
                              ))}
                            </div>
                            {leg.tip && <div style={{ fontSize:'0.75rem', color:C.muted, fontStyle:'italic', lineHeight:1.5 }}>💡 {leg.tip}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* REVIEW TAB */}
            {tab === 'review' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
                {pastReviews.length > 0 && (
                  <div style={{ background:C.card, border:`1px solid ${C.border}`, padding:'1rem 1.1rem' }}>
                    <div style={{ fontSize:'0.7rem', letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'0.8rem' }}>
                      {r.rvStats} — {pastReviews.length} {r.rvData}
                    </div>
                    <div className="review-stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.6rem' }}>
                      {[{lbl:'Tổng thể',k:'overall'},{lbl:'Phù hợp',k:'relevance'},{lbl:'Thực tế',k:'accuracy'},{lbl:'Dễ dùng',k:'usability'}].map(({lbl,k}) => (
                        <div key={k} style={{ textAlign:'center' }}>
                          <div style={{ fontSize:'1.5rem', fontFamily:"'Playfair Display',serif", color:C.rust, lineHeight:1 }}>{avgStat(k)}</div>
                          <div style={{ fontSize:'0.7rem', color:'#E8A020', marginBottom:2 }}>{'★'.repeat(Math.round(+avgStat(k)))}{'☆'.repeat(5-Math.round(+avgStat(k)))}</div>
                          <div style={{ fontSize:'0.62rem', color:C.muted }}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!submitted ? (
                  <div style={{ background:C.card, border:`1px solid ${C.border}`, padding:'1.1rem' }}>
                    <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.1rem', marginBottom:4 }}>{r.rvTitle}</h3>
                    <p style={{ fontSize:'0.76rem', color:C.muted, marginBottom:'1.2rem', lineHeight:1.6 }}>{r.rvSub}</p>
                    <StarRow label={r.rvOverall}    value={ratings.overall}   onChange={v => setRatings(rv => ({...rv, overall:v}))}/>
                    <StarRow label={r.rvRelevance}  value={ratings.relevance} onChange={v => setRatings(rv => ({...rv, relevance:v}))}/>
                    <StarRow label={r.rvAccuracy}   value={ratings.accuracy}  onChange={v => setRatings(rv => ({...rv, accuracy:v}))}/>
                    <StarRow label={r.rvUsability}  value={ratings.usability} onChange={v => setRatings(rv => ({...rv, usability:v}))}/>
                    <div style={{ marginBottom:'1.1rem' }}>
                      <div style={{ fontSize:'0.82rem', color:C.ink, marginBottom:7 }}>{r.rvComment}</div>
                      <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder={r.rvPlaceholder} rows={3}
                        style={{ width:'100%', fontFamily:"'Be Vietnam Pro',sans-serif", fontSize:'0.83rem', color:C.ink, border:`1px solid ${C.border}`, background:C.cream, padding:'0.7rem 0.85rem', resize:'vertical', outline:'none', lineHeight:1.6 }}/>
                    </div>
                    <div className="review-actions" style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <BtnPrimary onClick={submitReview} disabled={ratings.overall===0} style={{ flex:2 }}>{r.rvSubmit}</BtnPrimary>
                      {ratings.overall===0 && <span style={{ fontSize:'0.73rem', color:C.muted }}>{r.rvRequired}</span>}
                    </div>
                  </div>
                ) : (
                  <div style={{ background:'rgba(61,92,53,0.06)', border:'1px solid rgba(61,92,53,0.25)', padding:'1.25rem', textAlign:'center' }}>
                    <div style={{ fontSize:'2rem', marginBottom:8 }}>🎉</div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.1rem', marginBottom:5 }}>{r.rvThank}</div>
                    <div style={{ fontSize:'0.8rem', color:C.muted, lineHeight:1.6 }}>{r.rvThankSub}</div>
                  </div>
                )}

                {pastReviews.length > 0 && (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.85rem' }}>
                      <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1rem' }}>{r.rvHistory}</h3>
                      <button onClick={() => { localStorage.removeItem(LS_KEY); setPastReviews([]) }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.72rem', color:C.muted, fontFamily:"'Be Vietnam Pro',sans-serif" }}>{r.rvClear}</button>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                      {pastReviews.map((entry,i) => (
                        <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, padding:'0.9rem 1rem' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                              <span style={{ fontSize:'0.75rem', fontWeight:600, color:C.ink }}>{(entry.mood && (t.moods as Record<string, { label: string }>)[entry.mood]?.label)||entry.mood}</span>
                              <span style={{ fontSize:'0.68rem', color:C.muted }}>{entry.groupLabel}</span>
                            </div>
                            <div style={{ fontSize:'0.85rem', color:'#E8A020' }}>{'★'.repeat(entry.ratings?.overall||0)}{'☆'.repeat(5-(entry.ratings?.overall||0))}</div>
                          </div>
                          {entry.comment && <div style={{ fontSize:'0.78rem', color:C.muted, fontStyle:'italic', borderLeft:`2px solid ${C.border}`, paddingLeft:'0.6rem', lineHeight:1.6 }}>"{entry.comment}"</div>}
                          <div style={{ fontSize:'0.65rem', color:C.border, marginTop:5 }}>{entry.date}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ position:'relative', zIndex:1, borderTop:`1px solid ${C.border}`, padding:'0.85rem 1.75rem', fontSize:'0.67rem', color:C.muted, textAlign:'center' }}>
        {r.footer}
      </div>
    </div>
  )
}
