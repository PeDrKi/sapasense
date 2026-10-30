import { useState, useEffect, type ReactNode } from 'react'
import type { Place, Review } from '../types'
import { getPlaces, savePlaces, resetPlaces, cacheRemotePlaces } from '../data/placeStore'
import { PLACES } from '../data/places'
import { API_URL } from '../config'
import { adminMe, adminReviews, adminSavePlaces, adminStats, adminAudit, adminDeleteReview, getAdminToken, setAdminToken, type AdminMe, type AdminStats, type AuditEntry } from '../utils/backend'
import { INTERVIEWS, B1_SUMMARY } from '../data/interviewData'
import { C, MARKER_COLORS }    from '../styles/tokens'

// Set VITE_ADMIN_PASSWORD at build time. NOTE: this is a client-side gate only (demo/classroom use);
// real protection needs a server. The default is for local development.
const ENV_PASSWORD   = import.meta.env.VITE_ADMIN_PASSWORD
const ADMIN_PASSWORD = ENV_PASSWORD || 'sapasense2026'
const SHOW_DEFAULT_HINT = !ENV_PASSWORD && import.meta.env.DEV
const LS_REVIEWS     = 'sapasense_reviews'
const LS_SESSION     = 'sapasense_admin_session'

const A = {
  ...C,
  sidebar: '#1A1916', sideText:'#9A9490',
  green:'#2E7D52', greenL:'rgba(46,125,82,0.1)',
  red:'#C0392B',   redL:'rgba(192,57,43,0.1)',
  blue:'#2471A3',  blueL:'rgba(36,113,163,0.1)',
  yellow:'#B7950B',yellowL:'rgba(183,149,11,0.1)',
}

type Interview = (typeof INTERVIEWS)[number]
type PlaceDraft = Omit<Place, 'lat' | 'lng'> & { lat: number | string; lng: number | string }

function loadReviews(): Review[] { try { return JSON.parse(localStorage.getItem(LS_REVIEWS)||'[]') } catch { return [] } }
const loadPlaces = getPlaces

function StatCard({ icon, label, value, color=A.rust }: { icon: ReactNode; label: string; value: ReactNode; color?: string }) {
  return (
    <div style={{ background:'white', border:`1px solid ${A.border}`, padding:'1.1rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem' }}>
      <div style={{ width:44, height:44, borderRadius:'50%', background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem', flexShrink:0 }}>{icon}</div>
      <div>
        <div style={{ fontSize:'1.6rem', fontWeight:700, color, lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:'0.72rem', color:A.muted, marginTop:3 }}>{label}</div>
      </div>
    </div>
  )
}

// ── LOGIN ─────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (me: AdminMe) => void }) {
  const [pw, setPw]   = useState('')
  const [err, setErr] = useState(false)

  const [msg, setMsg] = useState('')
  const fail = (m: string) => { setErr(true); setMsg(m); setPw(''); setTimeout(() => setErr(false), 2500) }
  const submit = async () => {
    if (API_URL) {
      // the server checks the token (secret ADMIN_TOKEN of the Worker); nothing is decided in the browser
      const me = await adminMe(pw)
      if (me) { setAdminToken(pw); sessionStorage.setItem(LS_SESSION,'1'); onLogin(me) }
      else fail(me === false ? 'Token không đúng' : 'Không kết nối được máy chủ (hoặc Admin chưa được bật)')
      return
    }
    if (pw === ADMIN_PASSWORD) { sessionStorage.setItem(LS_SESSION,'1'); onLogin({ name:'admin', role:'editor' }) }
    else fail('Mật khẩu không đúng')
  }

  return (
    <div style={{ minHeight:'100vh', background:A.sidebar, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:A.cream, padding:'2.5rem 2rem', width:360, border:`1px solid ${A.border}` }}>
        <div style={{ width:48, height:48, borderRadius:'50%', border:`2px solid ${A.ink}`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Playfair Display',serif", fontSize:16, margin:'0 auto 1.5rem' }}>ss</div>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.5rem', textAlign:'center', marginBottom:4 }}>Admin Dashboard</h1>
        <p style={{ fontSize:'0.78rem', color:A.muted, textAlign:'center', marginBottom:'1.75rem' }}>SapaSense · Hệ thống quản trị</p>
        <div style={{ marginBottom:'1rem' }}>
          <label htmlFor="admin-pw" style={{ fontSize:'0.8rem', color:A.muted, display:'block', marginBottom:6 }}>{API_URL ? 'Token quản trị' : 'Mật khẩu quản trị'}</label>
          <input id="admin-pw" type="password" autoFocus value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key==='Enter'&&void submit()} placeholder="Nhập mật khẩu..."
            style={{ width:'100%', padding:'0.75rem', fontSize:'0.9rem', border:`1px solid ${err?A.red:A.border}`, background:err?A.redL:'white', fontFamily:"'Be Vietnam Pro',sans-serif", outline:'none' }}/>
          {err && <p style={{ fontSize:'0.72rem', color:A.red, marginTop:5 }}><span role="alert">{msg}</span></p>}
        </div>
        <button onClick={() => void submit()} style={{ width:'100%', background:A.ink, color:A.cream, border:'none', padding:'0.85rem', fontSize:'0.88rem', fontFamily:"'Be Vietnam Pro',sans-serif", fontWeight:500, cursor:'pointer' }}>Đăng nhập →</button>
        {!API_URL && SHOW_DEFAULT_HINT && <p style={{ fontSize:'0.68rem', color:A.border, textAlign:'center', marginTop:'1rem' }}>Dev: mật khẩu mặc định sapasense2026 (đặt VITE_ADMIN_PASSWORD để đổi)</p>}
      </div>
    </div>
  )
}

// ── OVERVIEW ──────────────────────────────────────────
function OverviewModule({ places, reviews, stats }: { places: Place[]; reviews: Review[]; stats: AdminStats | null }) {
  const avg = reviews.length ? (reviews.reduce((s: number, r: Review)=>s+(r.ratings?.overall||0),0)/reviews.length).toFixed(1) : '—'
  const typeCounts = places.reduce<Record<string, number>>((acc,p) => { acc[p.type]=(acc[p.type]||0)+1; return acc }, {})

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.25rem', marginBottom:'1.1rem', paddingBottom:'0.6rem', borderBottom:`1px solid ${A.border}` }}>📊 Tổng quan hệ thống</h2>
      <div className="admin-grid-4" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.75rem', marginBottom:'1.75rem' }}>
        <StatCard icon="📍" label="Tổng địa điểm"    value={places.length}               color={A.rust}  />
        <StatCard icon="⭐" label="Lượt đánh giá"    value={reviews.length}              color={A.yellow}/>
        <StatCard icon="🎯" label="Điểm TB tổng thể" value={avg}                         color={A.green} />
        <StatCard icon="🎤" label="Phiếu phỏng vấn"  value={B1_SUMMARY.totalInterviewed} color={A.blue}  />
      </div>
      {stats && (
        <div className="admin-grid-4" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.75rem', marginBottom:'1.75rem' }}>
          <StatCard icon="🔗" label="Thiết bị đã bật đồng bộ" value={stats.syncDevices} color={A.blue}/>
          <StatCard icon="🟢" label="Hoạt động 7 ngày"        value={stats.active7d}    color={A.green}/>
          <StatCard icon="📆" label="Hoạt động 30 ngày"       value={stats.active30d}   color={A.sage}/>
          <StatCard icon="🆕" label="Đánh giá mới 7 ngày"     value={stats.reviews7d}   color={A.yellow}/>
        </div>
      )}

      <div className="admin-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
        <div style={{ background:'white', border:`1px solid ${A.border}`, padding:'1.1rem' }}>
          <div style={{ fontSize:'0.82rem', fontWeight:600, marginBottom:'0.9rem' }}>Địa điểm theo loại</div>
          {Object.entries(typeCounts).map(([type, count]) => (
            <div key={type} style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.6rem' }}>
              <div style={{ fontSize:'0.82rem', minWidth:90, color:A.ink, textTransform:'capitalize' }}>{type}</div>
              <div style={{ flex:1, height:8, background:A.border, position:'relative' }}>
                <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${(count/places.length)*100}%`, background:A.rust, transition:'width 0.6s' }}/>
              </div>
              <div style={{ fontSize:'0.78rem', color:A.muted, minWidth:24, textAlign:'right' }}>{count}</div>
            </div>
          ))}
        </div>

        <div style={{ background:'white', border:`1px solid ${A.border}`, padding:'1.1rem' }}>
          <div style={{ fontSize:'0.82rem', fontWeight:600, marginBottom:'0.9rem' }}>Vấn đề du khách (B1)</div>
          {B1_SUMMARY.topProblems.map((p,i) => (
            <div key={i} style={{ display:'flex', gap:'0.6rem', marginBottom:'0.65rem', alignItems:'flex-start' }}>
              <div style={{ minWidth:22, height:22, background:A.rust, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', fontWeight:700, flexShrink:0 }}>{i+1}</div>
              <div>
                <div style={{ fontSize:'0.78rem', color:A.ink, lineHeight:1.4 }}>{p.problem}</div>
                <div style={{ fontSize:'0.68rem', color:A.muted }}>{p.count}/20 người</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background:'white', border:`1px solid ${A.border}`, padding:'1.1rem' }}>
          <div style={{ fontSize:'0.82rem', fontWeight:600, marginBottom:'0.9rem' }}>Key Insights (B1)</div>
          {B1_SUMMARY.keyInsights.map((ins,i) => (
            <div key={i} style={{ display:'flex', gap:'0.5rem', marginBottom:'0.65rem' }}>
              <span style={{ color:A.green, flexShrink:0 }}>✓</span>
              <span style={{ fontSize:'0.78rem', color:A.muted, lineHeight:1.5 }}>{ins}</span>
            </div>
          ))}
        </div>

        <div style={{ background:'white', border:`1px solid ${A.border}`, padding:'1.1rem' }}>
          <div style={{ fontSize:'0.82rem', fontWeight:600, marginBottom:'0.9rem' }}>Phân bổ tâm trạng (B1)</div>
          {Object.entries(B1_SUMMARY.moodDistribution).map(([mood, count]) => {
            const labels: Record<string, string> = { calm:'Bình yên', adventure:'Phiêu lưu', nostalgia:'Hoài niệm', energy:'Sôi động' }
            const total  = Object.values(B1_SUMMARY.moodDistribution).reduce((a,b)=>a+b,0)
            return (
              <div key={mood} style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.6rem' }}>
                <div style={{ fontSize:'0.82rem', minWidth:90, color:A.ink }}>{labels[mood]}</div>
                <div style={{ flex:1, height:8, background:A.border, position:'relative' }}>
                  <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${total ? (count/total)*100 : 0}%`, background:A.sage }}/>
                </div>
                <div style={{ fontSize:'0.78rem', color:A.muted, minWidth:40, textAlign:'right' }}>{count} ({total ? Math.round(count/total*100) : 0}%)</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── PLACES ────────────────────────────────────────────
function PlacesModule({ places, setPlaces, canEdit }: { places: Place[]; setPlaces: (p: Place[]) => void; canEdit: boolean }) {
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('all')
  const [editing, setEditing] = useState<PlaceDraft | null>(null)
  const [isNew,   setIsNew]   = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)

  const filtered = places.filter(p => {
    const q = search.toLowerCase()
    return (!q || p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q)) &&
           (filter === 'all' || p.type === filter)
  })

  const [saveErr, setSaveErr] = useState('')
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { setEditing(null); setConfirm(null) } }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [])
  /** Shared database when the API is configured (the server validates), else this browser only. */
  const persist = async (updated: Place[]): Promise<boolean> => {
    if (!API_URL) { savePlaces(updated); return true }
    try { await adminSavePlaces(getAdminToken(), updated); cacheRemotePlaces(updated); setSaveErr(''); return true }
    catch (e) { setSaveErr('Không lưu được lên máy chủ: ' + (e as Error).message); return false }
  }
  const save = async (draft: PlaceDraft) => {
    const place = draft as unknown as Place
    const updated = isNew ? [...places, { ...place, id:`CUSTOM_${Date.now()}` }] : places.map(p => p.id===place.id ? place : p)
    if (await persist(updated)) { setPlaces(updated); setEditing(null) }
  }

  const del = async (id: string) => {
    const updated = places.filter(p => p.id !== id)
    if (await persist(updated)) { setPlaces(updated); setConfirm(null) }
  }
  const reset = async () => {
    if (!API_URL) { setPlaces(resetPlaces()); return }
    if (window.confirm('Đặt lại toàn bộ địa điểm trên máy chủ về dữ liệu có sẵn trong app?') && await persist(PLACES)) setPlaces(PLACES)
  }

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(places, null, 2)], { type:'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href=url; a.download='places.json'; a.click()
  }

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.25rem', marginBottom:'1.1rem', paddingBottom:'0.6rem', borderBottom:`1px solid ${A.border}` }}>📍 Quản lý địa điểm</h2>
      {!canEdit && <p style={{ fontSize:'0.74rem', color:A.muted, marginBottom:'0.7rem' }}>Tài khoản chỉ xem — không thể thêm, sửa hoặc xoá.</p>}
      {API_URL && <p style={{ fontSize:'0.74rem', color:A.green, marginBottom:'0.7rem' }}>Đang lưu vào cơ sở dữ liệu dùng chung — mọi người sẽ thấy thay đổi ở lần mở app kế tiếp.</p>}
      {saveErr && <p role="alert" style={{ fontSize:'0.78rem', color:A.red, marginBottom:'0.7rem' }}>{saveErr}</p>}
      <div style={{ display:'flex', gap:'0.6rem', marginBottom:'1rem', flexWrap:'wrap', alignItems:'center' }}>
        <input aria-label="Tìm địa điểm" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm..." style={{ flex:1, minWidth:180, padding:'0.6rem 0.8rem', fontSize:'0.83rem', border:`1px solid ${A.border}`, fontFamily:"'Be Vietnam Pro',sans-serif", outline:'none' }}/>
        <select aria-label="Lọc theo loại" value={filter} onChange={e => setFilter(e.target.value)} style={{ padding:'0.6rem', fontSize:'0.83rem', border:`1px solid ${A.border}`, background:'white', cursor:'pointer' }}>
          {['all','attraction','food','cafe','museum','nature','market','lodging'].map(t => <option key={t} value={t}>{t==='all'?'Tất cả':t}</option>)}
        </select>
        {canEdit && <button onClick={() => { setEditing({ id:'',name:'',area:'VQG Hoàng Liên',lat:'',lng:'',type:'attraction',moods:[],groups:[],indoor:false,timeOfDay:[],duration:60,cost:0,desc:'',badges:[],tip:'' }); setIsNew(true) }} style={{ background:A.ink, color:A.cream, border:'none', padding:'0.6rem 1rem', fontSize:'0.83rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif" }}>+ Thêm</button>}
        <button onClick={exportJSON} style={{ background:'transparent', color:A.muted, border:`1px solid ${A.border}`, padding:'0.6rem 1rem', fontSize:'0.83rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif" }}>⬇ Xuất JSON</button>
        {canEdit && <button onClick={() => void reset()} style={{ background:'transparent', color:A.red, border:`1px solid ${A.red}`, padding:'0.6rem 1rem', fontSize:'0.83rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif" }}>↺ Reset</button>}
      </div>
      <div style={{ fontSize:'0.72rem', color:A.muted, marginBottom:'0.75rem' }}>{filtered.length}/{places.length} địa điểm</div>
      <div style={{ background:'white', border:`1px solid ${A.border}`, overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
          <thead>
            <tr style={{ background:A.cream, borderBottom:`1px solid ${A.border}` }}>
              {['ID','Tên','Khu vực','Loại','Chi phí','Thao tác'].map(h => (
                <th key={h} style={{ padding:'0.65rem 0.8rem', textAlign:'left', fontWeight:600, fontSize:'0.72rem', color:A.muted, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((place, i) => (
              <tr key={place.id} style={{ borderBottom:`1px solid ${A.border}`, background:i%2?'white':'#FAFAF8' }}>
                <td style={{ padding:'0.6rem 0.8rem', color:A.muted, fontSize:'0.68rem', fontFamily:'monospace' }}>{place.id}</td>
                <td style={{ padding:'0.6rem 0.8rem', fontWeight:500 }}>{place.name}</td>
                <td style={{ padding:'0.6rem 0.8rem', color:A.muted }}>{place.area}</td>
                <td style={{ padding:'0.6rem 0.8rem' }}><span style={{ fontSize:'0.68rem', padding:'0.15rem 0.5rem', background:A.rustLight, color:A.rust }}>{place.type}</span></td>
                <td style={{ padding:'0.6rem 0.8rem', color:place.cost===0?A.green:A.ink }}>{place.cost===0?'Miễn phí':`${place.cost.toLocaleString('vi-VN')}đ`}</td>
                <td style={{ padding:'0.6rem 0.8rem' }}>
                  <div style={{ display:'flex', gap:6 }}>
                    {canEdit && <button onClick={() => { setEditing({...place}); setIsNew(false) }} style={{ background:A.blueL, color:A.blue, border:'none', padding:'0.3rem 0.6rem', fontSize:'0.72rem', cursor:'pointer' }}>Sửa</button>}
                    {canEdit && <button onClick={() => setConfirm(place.id)} style={{ background:A.redL, color:A.red, border:'none', padding:'0.3rem 0.6rem', fontSize:'0.72rem', cursor:'pointer' }}>Xóa</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div role="dialog" aria-modal="true" aria-label="Xác nhận xoá" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
          <div style={{ background:'white', padding:'1.75rem', maxWidth:360, border:`1px solid ${A.border}` }}>
            <h3 style={{ marginBottom:8, fontFamily:"'Playfair Display',serif" }}>Xác nhận xóa?</h3>
            <p style={{ fontSize:'0.83rem', color:A.muted, marginBottom:'1.25rem' }}>Không thể hoàn tác.</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setConfirm(null)} style={{ flex:1, background:'transparent', border:`1px solid ${A.border}`, padding:'0.7rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif" }}>Huỷ</button>
              <button onClick={() => del(confirm)} style={{ flex:1, background:A.red, color:'white', border:'none', padding:'0.7rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif" }}>Xóa</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div role="dialog" aria-modal="true" aria-label="Biểu mẫu địa điểm" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:9999, overflowY:'auto', padding:'2rem' }}>
          <div style={{ background:'white', width:'100%', maxWidth:600, border:`1px solid ${A.border}` }}>
            <div style={{ padding:'1.1rem 1.5rem', borderBottom:`1px solid ${A.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.1rem' }}>{isNew ? '+ Thêm địa điểm' : `Sửa: ${editing.name}`}</h3>
              <button onClick={() => setEditing(null)} aria-label="Đóng" style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem', color:A.muted }}>✕</button>
            </div>
            <PlaceForm place={editing} isNew={isNew} onSave={(d) => void save(d)} onClose={() => setEditing(null)}/>
          </div>
        </div>
      )}
    </div>
  )
}

function PlaceForm({ place, isNew, onSave, onClose }: { place: PlaceDraft; isNew: boolean; onSave: (p: PlaceDraft) => void; onClose: () => void }) {
  const [form, setForm] = useState<PlaceDraft>({ ...place })
  const set = (k: keyof PlaceDraft, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const toggleArr = (key: 'moods' | 'groups' | 'timeOfDay', val: string) => {
    const arr: string[] = form[key] || []
    set(key, arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }
  const inp = { width:'100%', padding:'0.6rem 0.75rem', fontSize:'0.83rem', border:`1px solid ${A.border}`, fontFamily:"'Be Vietnam Pro',sans-serif", outline:'none' }
  const lbl = { fontSize:'0.75rem', color:A.muted, display:'block', marginBottom:4 }
  const latOk = Number.isFinite(+form.lat) && form.lat !== '' && +form.lat > 20.5 && +form.lat < 21.5
  const lngOk = Number.isFinite(+form.lng) && form.lng !== '' && +form.lng > 105.4 && +form.lng < 106.3
  const valid = !!form.name?.trim() && latOk && lngOk
  const submit = () => {
    if (!valid) return
    onSave({
      ...form, lat:+form.lat, lng:+form.lng, cost:+form.cost || 0, duration:+form.duration || 60,
      moods:     form.moods?.length     ? form.moods     : ['calm','adventure','nostalgia','energy'],
      groups:    form.groups?.length    ? form.groups    : ['solo','couple','friends','family'],
      timeOfDay: form.timeOfDay?.length ? form.timeOfDay : ['any'],
    })
  }

  return (
    <>
      <div style={{ padding:'1.25rem 1.5rem', display:'flex', flexDirection:'column', gap:'0.9rem' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
          <div><label htmlFor="pf-1" style={lbl}>Tên *</label><input id="pf-1" style={inp} value={form.name} onChange={e => set('name',e.target.value)} placeholder="Vườn Quốc gia Hoàng Liên"/></div>
          <div><label htmlFor="pf-2" style={lbl}>Khu vực</label><select id="pf-2" style={inp} value={form.area} onChange={e => set('area',e.target.value)}>
              {['Núi Ngũ Chỉ Sơn','VQG Hoàng Liên','Hồ Séo Mý Tỷ','Bản Tả Phìn','Thác Tình Yêu','Khác'].map(a=><option key={a}>{a}</option>)}
            </select>
          </div>
          <div><label htmlFor="pf-3" style={lbl}>Vĩ độ (lat)</label><input id="pf-3" style={{...inp, borderColor:latOk||form.lat===''?A.border:A.red}} value={form.lat} onChange={e => set('lat',e.target.value)} placeholder="21.0285"/></div>
          <div><label htmlFor="pf-4" style={lbl}>Kinh độ (lng)</label><input id="pf-4" style={{...inp, borderColor:lngOk||form.lng===''?A.border:A.red}} value={form.lng} onChange={e => set('lng',e.target.value)} placeholder="105.8522"/></div>
          <div><label htmlFor="pf-5" style={lbl}>Loại</label><select id="pf-5" style={inp} value={form.type} onChange={e => set('type',e.target.value)}>
              {['attraction','food','cafe','museum','nature','market','lodging'].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div><label htmlFor="pf-6" style={lbl}>Chi phí (VND, 0=miễn phí)</label><input id="pf-6" style={inp} type="number" value={form.cost} onChange={e => set('cost',+e.target.value)}/></div>
          <div><label htmlFor="pf-7" style={lbl}>Thời gian (phút)</label><input id="pf-7" style={inp} type="number" value={form.duration} onChange={e => set('duration',+e.target.value)}/></div>
          <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:18 }}>
            <input type="checkbox" id="indoor" checked={form.indoor} onChange={e => set('indoor',e.target.checked)}/>
            <label htmlFor="indoor" style={{ fontSize:'0.83rem', cursor:'pointer' }}>Địa điểm trong nhà</label>
          </div>
        </div>
        <div><label htmlFor="pf-8" style={lbl}>Mô tả</label><textarea id="pf-8" style={{ ...inp, resize:'vertical' }} rows={3} value={form.desc} onChange={e => set('desc',e.target.value)}/></div>
        <div><label htmlFor="pf-9" style={lbl}>Mẹo nhỏ</label><input id="pf-9" style={inp} value={form.tip||''} onChange={e => set('tip',e.target.value)}/></div>
        <div><label htmlFor="pf-img" style={lbl}>Ảnh (URL, hoặc tên file trong public/places/; để trống = public/places/ID.webp)</label><input id="pf-img" style={inp} value={form.img||''} onChange={e => set('img',e.target.value)} placeholder="https://… hoặc SP002.webp"/></div>
        <div><label htmlFor="pf-imgc" style={lbl}>Nguồn / tác giả ảnh</label><input id="pf-imgc" style={inp} value={form.imgCredit||''} onChange={e => set('imgCredit',e.target.value)} placeholder="Ảnh: Tên tác giả / Wikimedia Commons"/></div>
        <div><label htmlFor="pf-10" style={lbl}>Badges (phân cách bằng dấu phẩy)</label><input id="pf-10" style={inp} value={(form.badges||[]).join(', ')} onChange={e => set('badges',e.target.value.split(',').map(s=>s.trim()).filter(Boolean))}/></div>
        <div>
          <label style={lbl}>Tâm trạng phù hợp</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[['calm','Bình yên'],['adventure','Phiêu lưu'],['nostalgia','Hoài niệm'],['energy','Sôi động']].map(([id,lbl2]) => (
              <label key={id} style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.8rem', cursor:'pointer' }}>
                <input type="checkbox" checked={((form.moods||[]) as string[]).includes(id)} onChange={() => toggleArr('moods',id as string)}/>{lbl2}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label style={lbl}>Nhóm phù hợp</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[['solo','Một mình'],['couple','Cặp đôi'],['friends','Nhóm bạn'],['family','Gia đình']].map(([id,lbl2]) => (
              <label key={id} style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.8rem', cursor:'pointer' }}>
                <input type="checkbox" checked={((form.groups||[]) as string[]).includes(id)} onChange={() => toggleArr('groups',id)}/>{lbl2}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label style={lbl}>Thời điểm</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[['morning','Sáng'],['afternoon','Chiều'],['evening','Tối'],['any','Cả ngày']].map(([id,lbl2]) => (
              <label key={id} style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.8rem', cursor:'pointer' }}>
                <input type="checkbox" checked={((form.timeOfDay||[]) as string[]).includes(id)} onChange={() => toggleArr('timeOfDay',id)}/>{lbl2}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding:'1rem 1.5rem', borderTop:`1px solid ${A.border}`, display:'flex', gap:10 }}>
        <button onClick={onClose} style={{ flex:1, background:'transparent', border:`1px solid ${A.border}`, padding:'0.75rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif", color:A.muted }}>Huỷ</button>
        <button onClick={submit} disabled={!valid} style={{ flex:2, background:!valid?A.border:A.ink, color:A.cream, border:'none', padding:'0.75rem', cursor:valid?'pointer':'not-allowed', fontFamily:"'Be Vietnam Pro',sans-serif", fontWeight:500 }}>
          {isNew ? '+ Thêm' : '✓ Lưu'}
        </button>
      </div>
    </>
  )
}

// ── REVIEWS ───────────────────────────────────────────
function exportReviewsCSV(reviews: Review[]) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['Ngày','Tâm trạng','Thời gian','Nhóm','Ngân sách','Tổng thể','Phù hợp','Thực tế','Dễ dùng','Nhận xét','Điểm dừng']
  const rows = reviews.map(r => [r.date, r.mood, r.timeLabel, r.groupLabel, r.budgetLabel, r.ratings?.overall, r.ratings?.relevance, r.ratings?.accuracy, r.ratings?.usability, r.comment, (r.stops||[]).join(' → ')])
  const csv = '\uFEFF' + [head, ...rows].map(r => r.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = 'danh-gia.csv'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ReviewsModule({ reviews, notice = '', onDelete }: { reviews: (Review & { id?: number })[]; notice?: string; onDelete?: (id: number) => void }) {
  const avg = (key: string): string => reviews.length ? (reviews.reduce((s,r)=>s+(r.ratings?.[key]||0),0)/reviews.length).toFixed(1) : '0'
  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.25rem', marginBottom:'1.1rem', paddingBottom:'0.6rem', borderBottom:`1px solid ${A.border}` }}>⭐ Dữ liệu đánh giá (B4)</h2>
      {notice && <p role="alert" style={{ fontSize:'0.78rem', color:A.red, marginBottom:'0.7rem' }}>{notice}</p>}
      {reviews.length > 0 && <button onClick={() => exportReviewsCSV(reviews)} style={{ marginBottom:'1rem', background:'transparent', color:A.muted, border:`1px solid ${A.border}`, padding:'0.5rem 1rem', fontSize:'0.8rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif" }}>⬇ Xuất CSV</button>}
      {reviews.length === 0 ? (
        <div style={{ padding:'3rem', textAlign:'center', color:A.muted, background:'white', border:`1px solid ${A.border}` }}>
          <div style={{ fontSize:'2rem', marginBottom:8 }}>📋</div>
          <p style={{ fontSize:'0.85rem' }}>Chưa có đánh giá. Người dùng cần điền form ⭐ trong ứng dụng.</p>
        </div>
      ) : (
        <div>
          <div className="admin-grid-4" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.75rem', marginBottom:'1.5rem' }}>
            {[{k:'overall',l:'Tổng thể'},{k:'relevance',l:'Phù hợp'},{k:'accuracy',l:'Thực tế'},{k:'usability',l:'Dễ dùng'}].map(({k,l}) => (
              <div key={k} style={{ background:'white', border:`1px solid ${A.border}`, padding:'1rem', textAlign:'center' }}>
                <div style={{ fontSize:'2rem', fontFamily:"'Playfair Display',serif", color:A.rust }}>{avg(k)}</div>
                <div style={{ fontSize:'0.78rem', color:'#E8A020' }}>{'★'.repeat(Math.round(+avg(k)))}{'☆'.repeat(5-Math.round(+avg(k)))}</div>
                <div style={{ fontSize:'0.7rem', color:A.muted }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
            {reviews.map((rv,i) => (
              <div key={i} style={{ background:'white', border:`1px solid ${A.border}`, padding:'0.9rem 1rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <div style={{ fontSize:'0.78rem', color:A.muted }}>{rv.mood} · {rv.groupLabel} · {rv.budgetLabel}</div>
                  <div style={{ fontSize:'0.85rem', color:'#E8A020' }}>{'★'.repeat(rv.ratings?.overall||0)}{'☆'.repeat(5-(rv.ratings?.overall||0))}</div>
                </div>
                {rv.comment && <div style={{ fontSize:'0.78rem', color:A.muted, fontStyle:'italic', borderLeft:`2px solid ${A.border}`, paddingLeft:'0.6rem', lineHeight:1.6 }}>"{rv.comment}"</div>}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:5 }}>
                  <div style={{ fontSize:'0.68rem', color:A.muted }}>{rv.date}</div>
                  {onDelete && rv.id != null && <button type="button" aria-label={`Xoá đánh giá ${rv.id}`} onClick={() => { if (window.confirm('Xoá đánh giá này? Không thể hoàn tác.')) onDelete(rv.id!) }} style={{ background:A.redL, color:A.red, border:'none', padding:'0.25rem 0.6rem', fontSize:'0.72rem', cursor:'pointer' }}>Xoá</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── INTERVIEWS ────────────────────────────────────────
function InterviewsModule() {
  const [sel, setSel] = useState<Interview | null>(null)
  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.25rem', marginBottom:'1.1rem', paddingBottom:'0.6rem', borderBottom:`1px solid ${A.border}` }}>🎤 Dữ liệu phỏng vấn (B1)</h2>
      <div className="admin-grid-4" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.75rem', marginBottom:'1.25rem' }}>
        <StatCard icon="👥" label="Tổng phỏng vấn"  value={B1_SUMMARY.totalInterviewed}              color={A.blue}  />
        <StatCard icon="🇻🇳" label="Khách nội địa" value={B1_SUMMARY.demographics.domestic}          color={A.green} />
        <StatCard icon="✈️" label="Khách quốc tế"   value={B1_SUMMARY.demographics.international}    color={A.rust}  />
        <StatCard icon="📍" label="Người địa phương"    value={B1_SUMMARY.demographics.local}             color={A.yellow}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:'1rem' }}>
        <div style={{ background:'white', border:`1px solid ${A.border}`, overflow:'auto', maxHeight:520 }}>
          {INTERVIEWS.map((iv,i) => (
            <div key={iv.id} onClick={() => setSel(sel?.id===iv.id?null:iv)}
              style={{ padding:'0.75rem 1rem', cursor:'pointer', borderBottom:`1px solid ${A.border}`, background:sel?.id===iv.id?A.rustLight:i%2?'white':'#FAFAF8', borderLeft:`3px solid ${sel?.id===iv.id?A.rust:'transparent'}` }}>
              <div style={{ fontWeight:600, fontSize:'0.82rem' }}>{iv.id}</div>
              <div style={{ fontSize:'0.72rem', color:A.muted }}>{iv.profile.origin} · {iv.profile.age}t</div>
              <div style={{ fontSize:'0.68rem', color:A.rust, marginTop:2 }}>{iv.profile.type}</div>
            </div>
          ))}
        </div>
        <div style={{ background:'white', border:`1px solid ${A.border}`, padding:'1.1rem', overflow:'auto', maxHeight:520 }}>
          {!sel ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:A.muted, fontSize:'0.85rem' }}>← Chọn phiếu để xem chi tiết</div>
          ) : (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1rem' }}>
                <div>
                  <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.1rem' }}>{sel.id}</h3>
                  <p style={{ fontSize:'0.75rem', color:A.muted }}>{sel.date} · {sel.location}</p>
                </div>
                <span style={{ fontSize:'0.7rem', padding:'0.2rem 0.7rem', background:A.blueL, color:A.blue }}>{sel.profile.type}</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem', marginBottom:'1rem', fontSize:'0.8rem' }}>
                {[['Tuổi',sel.profile.age],['Giới tính',sel.profile.gender],['Nghề nghiệp',sel.profile.job],['Xuất phát',sel.profile.origin],['Thời gian',sel.answers.tripDuration],['Nhóm',sel.answers.groupType],['Ngân sách/ngày',`${sel.answers.budgetPerDay.toLocaleString('vi-VN')}đ`],['Công cụ',sel.answers.planningTool]].map(([k,v]) => (
                  <div key={k} style={{ background:A.cream, padding:'0.5rem 0.7rem' }}>
                    <div style={{ fontSize:'0.65rem', color:A.muted, marginBottom:2 }}>{k}</div>
                    <div style={{ fontWeight:500 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom:'0.75rem' }}>
                <div style={{ fontSize:'0.72rem', color:A.muted, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>Vấn đề thường gặp</div>
                {sel.answers.mainProblems.map((p: string, i: number) => (
                  <div key={i} style={{ display:'flex', gap:6, marginBottom:4 }}>
                    <span style={{ color:A.red }}>✗</span>
                    <span style={{ fontSize:'0.8rem', color:A.muted }}>{p}</span>
                  </div>
                ))}
              </div>
              <div style={{ background:A.greenL, border:'1px solid rgba(46,125,82,0.2)', padding:'0.75rem', fontSize:'0.8rem' }}>
                <strong style={{ color:A.green }}>Lý do dùng app:</strong>{' '}
                <span style={{ color:A.muted }}>{sel.answers.reason}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── AUDIT LOG ─────────────────────────────────────────
function AuditModule({ entries, error }: { entries: AuditEntry[]; error: string }) {
  const labels: Record<string, string> = { 'places.save': 'Lưu địa điểm', 'review.delete': 'Xoá đánh giá' }
  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.25rem', marginBottom:'1.1rem', paddingBottom:'0.6rem', borderBottom:`1px solid ${A.border}` }}>🧾 Nhật ký thao tác</h2>
      {error && <p role="alert" style={{ fontSize:'0.78rem', color:A.red, marginBottom:'0.7rem' }}>{error}</p>}
      {entries.length === 0 ? <p style={{ fontSize:'0.83rem', color:A.muted }}>Chưa có thao tác nào được ghi lại.</p> : (
        <div style={{ overflowX:'auto', background:'white', border:`1px solid ${A.border}` }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.78rem' }}>
            <thead><tr style={{ textAlign:'left', color:A.muted, borderBottom:`1px solid ${A.border}` }}>
              <th scope="col" style={{ padding:'0.6rem 0.8rem' }}>Thời gian</th><th scope="col" style={{ padding:'0.6rem 0.8rem' }}>Người làm</th><th scope="col" style={{ padding:'0.6rem 0.8rem' }}>Thao tác</th><th scope="col" style={{ padding:'0.6rem 0.8rem' }}>Chi tiết</th>
            </tr></thead>
            <tbody>{entries.map(e => (
              <tr key={e.id} style={{ borderBottom:`1px solid ${A.border}`, verticalAlign:'top' }}>
                <td style={{ padding:'0.6rem 0.8rem', whiteSpace:'nowrap' }}>{new Date(e.at).toLocaleString('vi-VN')}</td>
                <td style={{ padding:'0.6rem 0.8rem' }}>{e.actor}</td>
                <td style={{ padding:'0.6rem 0.8rem', whiteSpace:'nowrap' }}>{labels[e.action] || e.action}</td>
                <td style={{ padding:'0.6rem 0.8rem', color:A.muted }}>{e.detail}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── MAIN ADMIN ────────────────────────────────────────
export default function AdminScreen({ onExit }: { onExit: () => void }) {
  // `me` = who is signed in. With the API the server decides (token → name + role); without it a local password gates the screen.
  const [me, setMe] = useState<AdminMe | null>(() => (!API_URL && sessionStorage.getItem(LS_SESSION) ? { name:'admin', role:'editor' } : null))
  const [checking, setChecking] = useState(!!API_URL && !!getAdminToken())
  const [module,  setModule]  = useState('overview')
  const [places,  setPlaces]  = useState(loadPlaces)
  const [reviews, setReviews] = useState<(Review & { id?: number })[]>(loadReviews)
  const [reviewsErr, setReviewsErr] = useState('')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [auditErr, setAuditErr] = useState('')

  // returning to a tab that still has a token: ask the server who it is
  useEffect(() => {
    if (!checking) return
    adminMe(getAdminToken()).then(m => { if (m) setMe(m); else setAdminToken('') }).finally(() => setChecking(false))
  }, [checking])

  const loadServerData = () => {
    if (!API_URL) return
    const t = getAdminToken()
    adminReviews(t).then(r => { setReviews(r); setReviewsErr('') }).catch(() => setReviewsErr('Không tải được đánh giá từ máy chủ — đang hiện đánh giá lưu trong trình duyệt này.'))
    adminStats(t).then(setStats).catch(() => setStats(null))
    adminAudit(t).then(a => { setAudit(a); setAuditErr('') }).catch(() => setAuditErr('Không tải được nhật ký.'))
  }
  useEffect(() => { if (me) loadServerData() }, [me])
  useEffect(() => { if (me && module === 'audit') loadServerData() }, [module])   // refresh the log when it is opened

  const canEdit = me?.role === 'editor'
  const deleteReview = async (id: number) => {
    try { await adminDeleteReview(getAdminToken(), id); setReviews(rs => rs.filter(r => r.id !== id)); loadServerData() }
    catch (e) { setReviewsErr('Không xoá được: ' + (e as Error).message) }
  }
  const signOut = () => { sessionStorage.removeItem(LS_SESSION); setAdminToken(''); setMe(null); setStats(null) }

  const nav = [
    { id:'overview',   icon:'📊', label:'Tổng quan'  },
    { id:'places',     icon:'📍', label:'Địa điểm'   },
    { id:'reviews',    icon:'⭐', label:'Đánh giá'   },
    ...(API_URL ? [{ id:'audit', icon:'🧾', label:'Nhật ký' }] : []),
    { id:'interviews', icon:'🎤', label:'Phỏng vấn'  },
  ]

  if (checking) return <div role="status" style={{ padding:'3rem', textAlign:'center' }}>…</div>
  if (!me) return <LoginScreen onLogin={setMe}/>

  return (
    <div className="admin-wrap" style={{ display:'flex', minHeight:'100vh', fontFamily:"'Be Vietnam Pro',sans-serif" }}>
      {/* SIDEBAR (top bar on phones) */}
      <aside className="admin-side" style={{ width:220, background:A.sidebar, color:A.sideText, display:'flex', flexDirection:'column', flexShrink:0, position:'fixed', top:0, left:0, height:'100vh' }}>
        <div className="admin-brand" style={{ padding:'1.5rem 1.25rem', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontFamily:"'Playfair Display',serif", color:'white', fontSize:'1rem', marginBottom:2 }}>SapaSense</div>
          <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.55)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Admin Dashboard</div>
          <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.7)', marginTop:6 }}>{me.name} · {me.role === 'editor' ? 'Biên tập' : 'Chỉ xem'}</div>
        </div>
        <nav aria-label="Quản trị" className="admin-nav" style={{ padding:'0.75rem 0', flex:1 }}>
          {nav.map(item => (
            <button key={item.id} onClick={() => setModule(item.id)} aria-current={module===item.id ? 'page' : undefined}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem 1.25rem', background:module===item.id?'rgba(255,255,255,0.1)':'transparent', border:'none', color:module===item.id?'white':A.sideText, cursor:'pointer', fontSize:'0.85rem', fontFamily:"'Be Vietnam Pro',sans-serif", textAlign:'left' }}>
              <span aria-hidden="true">{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-foot" style={{ padding:'1rem 1.25rem', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', flexDirection:'column', gap:8 }}>
          <button onClick={onExit} style={{ width:'100%', background:'rgba(255,255,255,0.08)', color:A.sideText, border:'none', padding:'0.6rem', cursor:'pointer', fontSize:'0.8rem', fontFamily:"'Be Vietnam Pro',sans-serif" }}>← Về trang chủ</button>
          <button onClick={signOut} style={{ width:'100%', background:'transparent', color:'rgba(255,255,255,0.6)', border:'1px solid rgba(255,255,255,0.15)', padding:'0.5rem', cursor:'pointer', fontSize:'0.75rem', fontFamily:"'Be Vietnam Pro',sans-serif" }}>Đăng xuất</button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="admin-main" style={{ marginLeft:220, flex:1, minWidth:0, background:'#F7F5F1', minHeight:'100vh' }}>
        <div style={{ background:'white', borderBottom:`1px solid ${A.border}`, padding:'0.9rem 1.75rem', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <h1 style={{ fontSize:'1rem', fontWeight:600 }}>{nav.find(n=>n.id===module)?.icon} {nav.find(n=>n.id===module)?.label}</h1>
          <div style={{ fontSize:'0.75rem', color:A.muted }}>{new Date().toLocaleDateString('vi-VN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
        </div>
        <div className="admin-body" style={{ padding:'1.75rem' }}>
          {module==='overview'   && <OverviewModule    places={places} reviews={reviews} stats={stats}/>}
          {module==='places'     && <PlacesModule      places={places} setPlaces={setPlaces} canEdit={canEdit}/>}
          {module==='reviews'    && <ReviewsModule     reviews={reviews} notice={reviewsErr} onDelete={API_URL && canEdit ? (id) => void deleteReview(id) : undefined}/>}
          {module==='audit'      && <AuditModule       entries={audit} error={auditErr}/>}
          {module==='interviews' && <InterviewsModule/>}
        </div>
      </main>
    </div>
  )
}
