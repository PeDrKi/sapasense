import { useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react'
import { C } from '../styles/tokens'
import { getPlaces } from '../data/placeStore'
import { SEASONS_DATA } from '../data/seasons'
import { openState } from '../utils/openNow'
import { stopDirectionsUrl } from '../utils/share'
import { toggleFav, favIds } from '../utils/memory'
import { SPECIALTIES, SPECIALTIES_SRC, FESTIVALS, GUIDE_CHECKED } from '../data/guide'
import { gsap, reducedMotion, EASE } from '../utils/motion'
import PlaceImage from '../components/PlaceImage'
import SafetyNote from '../components/SafetyNote'
import LangToggle from '../components/LangToggle'
import { useLang } from '../i18n'
import type { Place, Weather } from '../types'

type Cat = 'all' | 'sight' | 'food' | 'stay'
type Sort = 'default' | 'priceAsc' | 'priceDesc'

const L10N = {
  VI: {
    back:'← Trang chủ', title:'Khám phá Sa Pa', sub:'Duyệt theo nhóm, khu vực, giá — rồi tạo lộ trình cho riêng bạn.',
    search:'Tìm địa điểm, món ăn, khu vực…', cats:{ all:'Tất cả', sight:'Tham quan', food:'Ăn uống', stay:'Lưu trú' },
    area:'Khu vực', allAreas:'Mọi khu vực', sort:'Sắp xếp', sorts:{ default:'Mặc định', priceAsc:'Giá thấp → cao', priceDesc:'Giá cao → thấp' },
    count:(n: number) => `${n} địa điểm`, none:'Không có địa điểm phù hợp.', free:'Miễn phí', perNight:'/đêm', perPerson:'/người',
    open:'Đang mở', closed:'Đã đóng', always:'Mở 24/24', hours:'Giờ mở cửa', closedDays:'Ngày nghỉ', note:'Ghi chú', address:'Địa chỉ', price:'Chi phí', duration:'Thời gian ở lại',
    season:'Mùa đẹp', tip:'Mẹo', directions:'Chỉ đường', fav:'♡ Muốn đi', faved:'♥ Đã lưu', close:'Đóng', plan:'✨ Tạo lộ trình Sa Pa cho tôi', minutes:(m: number) => m >= 60 ? `${Math.floor(m/60)}h${m%60 ? String(m%60).padStart(2,'0') : ''}` : `${m} phút`,
    foodTitle:'Đặc sản Sa Pa', festTitle:'Lễ hội & sự kiện', srcLbl:'Nguồn', checked:(d: string) => `Tổng hợp từ nguồn công khai, kiểm tra ${d}. Lịch lễ hội thay đổi theo năm — hãy xác nhận với ban tổ chức trước khi đi.`, need:'Cần biết', needItems:['Số khẩn cấp: Công an 113 · Cứu hỏa 114 · Cấp cứu 115.','Đường đèo dốc, sương mù và mưa thường thay đổi nhanh — kiểm tra thời tiết trước khi lên núi.','Khu vực trekking cần thuê người dẫn (porter); đi theo nhóm, báo lịch trình cho người ở nhà.'],
  },
  EN: {
    back:'← Home', title:'Explore Sa Pa', sub:'Browse by type, area and price — then build a plan of your own.',
    search:'Search places, dishes, areas…', cats:{ all:'All', sight:'Sights', food:'Food', stay:'Stays' },
    area:'Area', allAreas:'All areas', sort:'Sort', sorts:{ default:'Default', priceAsc:'Price low → high', priceDesc:'Price high → low' },
    count:(n: number) => `${n} places`, none:'No matching places.', free:'Free', perNight:'/night', perPerson:'/person',
    open:'Open now', closed:'Closed', always:'Open 24h', hours:'Opening hours', closedDays:'Closed', note:'Note (VI)', address:'Address', price:'Cost', duration:'Time needed',
    season:'Best season', tip:'Tip', directions:'Directions', fav:'♡ Want to go', faved:'♥ Saved', close:'Close', plan:'✨ Plan my Sa Pa day', minutes:(m: number) => m >= 60 ? `${Math.floor(m/60)}h${m%60 ? String(m%60).padStart(2,'0') : ''}` : `${m} min`,
    foodTitle:'Sa Pa specialties', festTitle:'Festivals & events', srcLbl:'Source', checked:(d: string) => `Compiled from public sources, checked ${d}. Festival dates change every year — confirm with the organisers before you go.`, need:'Good to know', needItems:['Emergency: Police 113 · Fire 114 · Ambulance 115.','Mountain roads, fog and rain change fast — check the weather before heading up.','Trekking areas need a guide/porter; go in a group and tell someone your plan.'],
  },
}

const catOf = (p: Place): Cat => p.type === 'lodging' ? 'stay' : (p.type === 'food' || p.type === 'cafe') ? 'food' : 'sight'
const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ'
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

export default function ExploreScreen({ wx, onHome, onPlan }: { wx: Weather | null; onHome: () => void; onPlan: () => void }) {
  const { lang } = useLang()
  const x = L10N[lang as 'VI' | 'EN'] || L10N.VI
  const all = useMemo(() => getPlaces(), [])
  const [cat, setCat] = useState<Cat>('all')
  const [area, setArea] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('default')
  const [sel, setSel] = useState<Place | null>(null)
  const [favs, setFavs] = useState<string[]>(() => favIds())
  const grid = useRef<HTMLDivElement>(null)

  const areas = useMemo(() => [...new Set(all.map(p => p.area).filter(Boolean))], [all])
  const list = useMemo(() => {
    const nq = norm(q.trim())
    let r = all.filter(p => (cat === 'all' || catOf(p) === cat) && (!area || p.area === area)
      && (!nq || norm([p.name, p.area, p.desc, p.badges.join(' ')].join(' ')).includes(nq)))
    if (sort !== 'default') r = [...r].sort((a, b) => sort === 'priceAsc' ? a.cost - b.cost : b.cost - a.cost)
    return r
  }, [all, cat, area, q, sort])

  useLayoutEffect(() => {
    if (reducedMotion() || !grid.current) return
    const ctx = gsap.context(() => { gsap.from('.ex-card', { y: 22, opacity: 0, duration: 0.45, stagger: 0.04, ease: EASE }) }, grid)
    return () => ctx.revert()
  }, [cat, area, sort])

  useEffect(() => {
    if (!sel) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setSel(null) }
    window.addEventListener('keydown', k); document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [sel])

  const priceOf = (p: Place) => p.cost === 0 ? x.free : fmt(p.cost) + (p.type === 'lodging' ? x.perNight : p.type === 'food' || p.type === 'cafe' ? x.perPerson : '')
  const stateChip = (p: Place) => {
    const s = openState(p.hours)
    if (!s) return null
    const on = s !== 'closed'
    return <span style={{ fontSize:'0.62rem', fontWeight:600, padding:'1px 6px', color:on?C.sage:'#A83D3D', background:on?C.sageLight:'rgba(168,61,61,0.1)' }}>{s === 'always' ? x.always : on ? x.open : x.closed}</span>
  }
  const chip = (on: boolean) => ({ fontSize:'0.78rem', padding:'0.4rem 0.85rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif", background:on?C.ink:'none', color:on?C.cream:C.ink, border:`1px solid ${on?C.ink:C.border}` } as const)
  const counts = (c: Cat) => all.filter(p => c === 'all' || catOf(p) === c).length

  return (
    <div style={{ minHeight:'100vh', background:C.cream, padding:'1.25rem 1rem 3rem' }}>
      <div style={{ maxWidth:980, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', gap:8, flexWrap:'wrap' }}>
          <button type="button" onClick={onHome} style={{ background:'none', border:'none', cursor:'pointer', color:C.ink, fontSize:'0.85rem', fontFamily:"'Be Vietnam Pro',sans-serif" }}>{x.back}</button>
          <LangToggle/>
        </div>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(1.8rem,5vw,2.6rem)', lineHeight:1.1, marginBottom:6 }}>{x.title}</h1>
        <p style={{ color:C.muted, fontSize:'0.9rem', marginBottom:'1rem' }}>{x.sub}</p>
        <div style={{ marginBottom:'1rem' }}><SafetyNote wx={wx}/></div>

        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={x.search} aria-label={x.search}
          style={{ width:'100%', boxSizing:'border-box', padding:'0.7rem 0.9rem', fontSize:'0.9rem', border:`1px solid ${C.border}`, background:'#fff', fontFamily:"'Be Vietnam Pro',sans-serif", marginBottom:'0.75rem' }}/>
        <div role="tablist" style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:'0.6rem' }}>
          {(['all','sight','food','stay'] as Cat[]).map(c => <button key={c} role="tab" aria-selected={cat===c} onClick={() => setCat(c)} style={chip(cat===c)}>{x.cats[c]} · {counts(c)}</button>)}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:'1rem' }}>
          <select aria-label={x.area} value={area} onChange={e => setArea(e.target.value)} style={{ ...chip(false), padding:'0.4rem 0.6rem' }}>
            <option value="">{x.allAreas}</option>{areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select aria-label={x.sort} value={sort} onChange={e => setSort(e.target.value as Sort)} style={{ ...chip(false), padding:'0.4rem 0.6rem' }}>
            {(Object.keys(x.sorts) as Sort[]).map(s => <option key={s} value={s}>{x.sorts[s]}</option>)}
          </select>
          <span role="status" style={{ fontSize:'0.78rem', color:C.muted }}>{x.count(list.length)}</span>
        </div>

        <div ref={grid} style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))', gap:14 }}>
          {list.map(p => (
            <button key={p.id} type="button" className="ex-card" onClick={() => setSel(p)}
              style={{ textAlign:'left', cursor:'pointer', background:C.card, border:`1px solid ${C.border}`, padding:'0.8rem', fontFamily:"'Be Vietnam Pro',sans-serif", color:C.ink }}>
              <PlaceImage place={p} height={130} credit={p.imgCredit}/>
              <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                <span style={{ fontSize:'0.64rem', letterSpacing:'0.08em', textTransform:'uppercase', color:C.rust }}>{p.area}</span>{stateChip(p)}
              </div>
              <div style={{ fontWeight:600, fontSize:'0.95rem', marginBottom:4 }}>{p.name}</div>
              <div style={{ fontSize:'0.78rem', color:C.muted, lineHeight:1.5, marginBottom:6, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.desc}</div>
              <div style={{ fontSize:'0.82rem', fontWeight:600, color:C.rust }}>{priceOf(p)}</div>
            </button>
          ))}
        </div>
        {list.length === 0 && <p style={{ textAlign:'center', color:C.muted, padding:'2rem 0' }}>{x.none}</p>}

        <section aria-label={x.foodTitle} style={{ marginTop:'2.2rem' }}>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.3rem', marginBottom:10 }}>{x.foodTitle}</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
            {SPECIALTIES.map(s => <div key={s.name} style={{ background:C.card, border:`1px solid ${C.border}`, padding:'0.7rem 0.85rem' }}>
              <div style={{ fontWeight:600, fontSize:'0.9rem', marginBottom:3 }}>{s.name}</div>
              <div style={{ fontSize:'0.78rem', color:C.muted, lineHeight:1.55 }}>{lang === 'EN' ? s.en : s.vi}</div></div>)}
          </div>
          <a href={SPECIALTIES_SRC} target="_blank" rel="noopener noreferrer" style={{ fontSize:'0.72rem', color:C.rust }}>{x.srcLbl}: baolaocai.vn</a>
        </section>
        <section aria-label={x.festTitle} style={{ marginTop:'2rem' }}>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.3rem', marginBottom:10 }}>{x.festTitle}</h2>
          <div style={{ display:'grid', gap:10 }}>
            {FESTIVALS.map(f => <div key={f.name} style={{ background:C.card, border:`1px solid ${C.border}`, padding:'0.75rem 0.9rem' }}>
              <div style={{ fontWeight:600, fontSize:'0.92rem' }}>{lang === 'EN' ? f.en : f.name}</div>
              <div style={{ fontSize:'0.74rem', color:C.rust, margin:'2px 0 4px' }}>🗓 {lang === 'EN' ? f.whenEn : f.when} · 📍 {f.where}</div>
              <div style={{ fontSize:'0.8rem', color:C.muted, lineHeight:1.55 }}>{lang === 'EN' ? f.en2 : f.vi}</div>
              <a href={f.src} target="_blank" rel="noopener noreferrer" style={{ fontSize:'0.7rem', color:C.rust }}>{x.srcLbl}</a></div>)}
          </div>
          <p style={{ fontSize:'0.72rem', color:C.muted, marginTop:6 }}>{x.checked(GUIDE_CHECKED)}</p>
        </section>
        <section aria-label={x.need} style={{ marginTop:'2rem', background:C.card, border:`1px solid ${C.border}`, padding:'1rem 1.1rem' }}>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.15rem', marginBottom:8 }}>{x.need}</h2>
          <ul style={{ margin:0, paddingLeft:'1.1rem', fontSize:'0.84rem', lineHeight:1.7, color:C.ink }}>{x.needItems.map(t => <li key={t}>{t}</li>)}</ul>
        </section>
        <div style={{ textAlign:'center', marginTop:'1.6rem' }}>
          <button type="button" onClick={onPlan} style={{ background:C.ink, color:C.cream, border:'none', padding:'0.85rem 1.8rem', cursor:'pointer', fontSize:'0.92rem', fontFamily:"'Be Vietnam Pro',sans-serif" }}>{x.plan}</button>
        </div>
      </div>

      {sel && (
        <div role="dialog" aria-modal="true" aria-label={sel.name} onClick={() => setSel(null)}
          style={{ position:'fixed', inset:0, background:'rgba(26,25,22,0.55)', zIndex:3000, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:C.cream, width:'100%', maxWidth:560, maxHeight:'92vh', overflowY:'auto', padding:'1.1rem 1.2rem 1.4rem' }}>
            <PlaceImage place={sel} height={190} credit={sel.imgCredit}/>
            <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4 }}>
              <span style={{ fontSize:'0.68rem', letterSpacing:'0.08em', textTransform:'uppercase', color:C.rust }}>{sel.area}</span>{stateChip(sel)}
            </div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.4rem', lineHeight:1.2, marginBottom:8 }}>{sel.name}</h2>
            <p style={{ fontSize:'0.88rem', lineHeight:1.65, marginBottom:10 }}>{sel.desc}</p>
            <dl style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'4px 12px', fontSize:'0.82rem', margin:'0 0 10px' }}>
              <dt style={{ color:C.muted }}>{x.price}</dt><dd style={{ margin:0 }}>{priceOf(sel)}</dd>
              {sel.type !== 'lodging' && <><dt style={{ color:C.muted }}>{x.duration}</dt><dd style={{ margin:0 }}>{x.minutes(sel.duration)}</dd></>}
              {sel.hours && <><dt style={{ color:C.muted }}>{x.hours}</dt><dd style={{ margin:0 }}>{sel.hours}</dd></>}
              {sel.closedNote && sel.closedNote !== 'Không nghỉ' && <><dt style={{ color:C.muted }}>{x.closedDays}</dt><dd style={{ margin:0 }}>{sel.closedNote}</dd></>}
              {sel.note && <><dt style={{ color:C.muted }}>{x.note}</dt><dd style={{ margin:0 }}>{sel.note}</dd></>}
              {sel.address && <><dt style={{ color:C.muted }}>{x.address}</dt><dd style={{ margin:0 }}>{sel.address}</dd></>}
              {SEASONS_DATA[sel.id] && <><dt style={{ color:C.muted }}>{x.season}</dt><dd style={{ margin:0 }}>{SEASONS_DATA[sel.id].season}</dd></>}
            </dl>
            {sel.tip && <p style={{ fontSize:'0.82rem', fontStyle:'italic', color:C.muted, lineHeight:1.6, marginBottom:10 }}>💡 {sel.tip}</p>}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>{sel.badges.map(b => <span key={b} style={{ fontSize:'0.68rem', padding:'2px 8px', background:'rgba(26,25,22,0.06)' }}>{b}</span>)}</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <a href={stopDirectionsUrl(sel, 'driving')} target="_blank" rel="noopener noreferrer" style={{ ...chip(true), textDecoration:'none' }}>📍 {x.directions}</a>
              <button type="button" onClick={() => { toggleFav(sel.id); setFavs(favIds()) }} style={chip(false)}>{favs.includes(sel.id) ? x.faved : x.fav}</button>
              <button type="button" onClick={() => setSel(null)} style={chip(false)}>{x.close}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
