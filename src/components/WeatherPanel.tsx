import { useEffect, useRef, useState } from 'react'
import { gsap, reducedMotion, EASE } from '../utils/motion'
import { fetchForecast, type DayForecast } from '../utils/forecast'
import { packingAdvice } from '../utils/packing'
import { wxLevel } from '../utils/weatherRules'
import { useLang } from '../i18n'
import type { Weather } from '../types'
import { WX_MAP } from '../data/constants'

const dayName = (iso: string, en: boolean) => new Date(iso + 'T12:00:00').toLocaleDateString(en ? 'en-GB' : 'vi-VN', { weekday:'short', day:'numeric', month:'numeric' })
const EMOJI = { fontFamily:'"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' } as const

type Mood = 'sun' | 'rain' | 'cold' | 'fog' | 'cloud'
function moodOf(code: number, temp: number | null): Mood {
  if (wxLevel({ code }) !== 'ok') return 'rain'
  if (code === 45 || code === 48) return 'fog'
  if (temp !== null && temp <= 10) return 'cold'
  if (code === 0 || code === 1) return 'sun'
  return 'cloud'
}
const GRAD: Record<Mood, string> = {
  sun:   'linear-gradient(135deg,#F6B84B 0%,#EF8A3C 100%)',
  cloud: 'linear-gradient(135deg,#7FA5C4 0%,#4F7A9C 100%)',
  rain:  'linear-gradient(135deg,#5B7C99 0%,#33485F 100%)',
  cold:  'linear-gradient(135deg,#6C9BD1 0%,#3C5E94 100%)',
  fog:   'linear-gradient(135deg,#A9B3B8 0%,#6F7C84 100%)',
}
const icon = (c: number) => (WX_MAP as Record<number, { icon: string }>)[c]?.icon || '🌤'

/** Thời tiết hiện tại + dự báo vài ngày + gợi ý trang phục / vật dụng cho ngày đi. */
export default function WeatherPanel({ wx, dateISO, limitedFitness, motionSick }: { wx: Weather | null; dateISO?: string; limitedFitness?: boolean; motionSick?: boolean }) {
  const { lang } = useLang(); const en = lang === 'EN'
  const [days, setDays] = useState<DayForecast[]>([]); const [stale, setStale] = useState(false); const [loaded, setLoaded] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const root = useRef<HTMLElement>(null)
  useEffect(() => { let on = true; fetchForecast().then(r => { if (on) { setDays(r.days); setStale(r.stale); setLoaded(true) } }); return () => { on = false } }, [])
  const planned = days.find(d => d.date === dateISO) || days[0]
  const day = days.find(d => d.date === sel) || planned

  useEffect(() => {
    if (!loaded || !days.length || reducedMotion() || !root.current) return
    const ctx = gsap.context(() => {
      gsap.from('.wp-hero', { y: 18, opacity: 0, duration: 0.55, ease: EASE })
      gsap.from('.wp-day', { y: 16, opacity: 0, duration: 0.45, stagger: 0.07, ease: EASE, delay: 0.15 })
      gsap.from('.wp-bar', { scaleX: 0, transformOrigin: 'left center', duration: 0.7, stagger: 0.07, ease: EASE, delay: 0.35 })
      gsap.from('.wp-tip', { y: 12, opacity: 0, duration: 0.4, stagger: 0.05, ease: EASE, delay: 0.4 })
    }, root)
    return () => ctx.revert()
  }, [loaded, days.length])

  if (!loaded) return null
  if (!day) return <div style={{ fontSize:'0.78rem', color:'#6b665a', marginBottom:'1rem', padding:'0.7rem 0.9rem', background:'#fff', border:'1px solid #E3DCCB', borderRadius:12 }}>{en ? 'Forecast unavailable (offline). Check the weather before you go.' : '📴 Chưa có dự báo (đang mất mạng). Hãy kiểm tra thời tiết trước khi đi.'}</div>

  const adv = packingAdvice(day, { en, limitedFitness, motionSick })
  const nowTemp = wx && wx.temp !== undefined && wx.temp !== '--' ? Number(wx.temp) : null
  const isPlannedToday = day.date === days[0]?.date
  const mood = moodOf(isPlannedToday && wx?.code !== undefined ? wx.code : day.code, isPlannedToday ? nowTemp : day.tMin)
  const items = adv.items.map(t => { const m = t.match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u); return { ic: m ? m[1] : '•', text: m ? m[2] : t } })
  const shown = more ? items : items.slice(0, 4)

  return (
    <section ref={root} aria-label={en ? 'Weather and packing' : 'Thời tiết và đồ mang theo'} style={{ marginBottom:'1.5rem' }}>
      {/* hero */}
      <div className="wp-hero" style={{ background:GRAD[mood], color:'#fff', borderRadius:18, padding:'1.1rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap', boxShadow:'0 8px 24px rgba(40,50,70,0.18)', transition:'background 0.4s' }}>
        <div style={{ ...EMOJI, fontSize:'3.2rem', lineHeight:1, filter:'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' }} aria-hidden="true">{isPlannedToday && wx?.icon ? wx.icon : icon(day.code)}</div>
        <div style={{ flex:1, minWidth:150 }}>
          <div style={{ fontSize:'0.72rem', letterSpacing:'0.08em', textTransform:'uppercase', opacity:0.85 }}>{isPlannedToday ? (en ? 'Right now in Sa Pa' : 'Sa Pa lúc này') : (en ? 'Forecast' : 'Dự báo') + ' · ' + dayName(day.date, en)}</div>
          <div style={{ fontSize:'2.3rem', fontWeight:700, lineHeight:1.1 }}>{isPlannedToday && nowTemp !== null ? `${nowTemp}°C` : `${day.tMin}°–${day.tMax}°`}</div>
          <div style={{ fontSize:'0.85rem', opacity:0.95 }}>{isPlannedToday && wx?.label ? wx.label : ((WX_MAP as Record<number, { label: string }>)[day.code]?.label || '')}{isPlannedToday && wx?.precip ? ` · ${wx.precip} mm` : ''}</div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <span style={{ background:'rgba(255,255,255,0.2)', padding:'0.35rem 0.7rem', borderRadius:999, fontSize:'0.78rem', backdropFilter:'blur(4px)' }}><span style={EMOJI}>🌡</span> {day.tMin}°–{day.tMax}°</span>
          <span style={{ background:'rgba(255,255,255,0.2)', padding:'0.35rem 0.7rem', borderRadius:999, fontSize:'0.78rem' }}><span style={EMOJI}>☔</span> {day.rainProb}%</span>
          <span style={{ background:'rgba(255,255,255,0.2)', padding:'0.35rem 0.7rem', borderRadius:999, fontSize:'0.78rem' }}><span style={EMOJI}>🕶</span> UV {Math.round(day.uv)}</span>
        </div>
      </div>

      {/* forecast days */}
      <div role="tablist" aria-label={en ? 'Forecast days' : 'Các ngày dự báo'} style={{ display:'grid', gridTemplateColumns:`repeat(${days.length},minmax(0,1fr))`, gap:8, margin:'0.75rem 0' }}>
        {days.map(d => { const on = d.date === day.date; const isPlan = d.date === planned?.date; return (
          <button key={d.date} role="tab" aria-selected={on} type="button" className="wp-day" onClick={() => setSel(d.date)}
            style={{ position:'relative', background:on?'#B5541C':'#fff', color:on?'#fff':'#2a2620', border:`1px solid ${on?'#B5541C':'#E3DCCB'}`, borderRadius:14, padding:'0.6rem 0.25rem 0.55rem', cursor:'pointer', fontFamily:'inherit', textAlign:'center', transition:'transform 0.18s, box-shadow 0.18s, background-color 0.18s, border-color 0.18s', boxShadow:on?'0 6px 16px rgba(181,84,28,0.3)':'none' }}
            onMouseEnter={e => { if (!on) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.08)' } }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; if (!on) e.currentTarget.style.boxShadow = 'none' }}>
            {isPlan && <span style={{ position:'absolute', top:-8, left:'50%', transform:'translateX(-50%)', fontSize:'0.58rem', background:on?'#2a2620':'#E8A020', color:'#fff', padding:'1px 7px', borderRadius:999, whiteSpace:'nowrap' }}>{en ? 'Your day' : 'Ngày đi'}</span>}
            <div style={{ fontSize:'0.68rem', opacity:0.8 }}>{dayName(d.date, en)}</div>
            <div style={{ ...EMOJI, fontSize:'1.6rem', margin:'2px 0' }}>{icon(d.code)}</div>
            <div style={{ fontWeight:700, fontSize:'0.82rem' }}>{d.tMin}°<span style={{ opacity:0.6 }}> / </span>{d.tMax}°</div>
            <div style={{ height:4, background:on?'rgba(255,255,255,0.3)':'#EFE9DA', borderRadius:4, margin:'6px 10px 3px', overflow:'hidden' }}><div className="wp-bar" style={{ width:`${Math.min(100, d.rainProb)}%`, height:'100%', background:on?'#fff':'#5B7C99', borderRadius:4 }}/></div>
            <div style={{ fontSize:'0.66rem', opacity:0.85 }}>☔ {d.rainProb}%</div>
          </button>) })}
      </div>

      {/* what to wear */}
      <div style={{ background:'#fff', border:'1px solid #E3DCCB', borderRadius:16, padding:'1rem 1.1rem' }}>
        <div style={{ display:'flex', gap:10, alignItems:'flex-start', background:'rgba(232,160,32,0.12)', borderRadius:12, padding:'0.7rem 0.85rem', marginBottom:'0.85rem' }}>
          <span style={{ ...EMOJI, fontSize:'1.5rem', lineHeight:1.2 }} aria-hidden="true">🧥</span>
          <div><div style={{ fontSize:'0.68rem', letterSpacing:'0.08em', textTransform:'uppercase', color:'#9A5B00', fontWeight:700 }}>{en ? 'What to wear' : 'Nên mặc'}</div><div style={{ fontSize:'0.88rem', lineHeight:1.5 }}>{adv.outfit}</div></div>
        </div>
        <div style={{ fontSize:'0.68rem', letterSpacing:'0.08em', textTransform:'uppercase', color:'#6b665a', fontWeight:700, marginBottom:8 }}>{en ? 'Pack list' : 'Nên mang theo'}</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:8 }}>
          {shown.map((it, i) => (
            <div key={i} className="wp-tip" style={{ display:'flex', gap:10, alignItems:'flex-start', background:'#FAF7F0', borderRadius:12, padding:'0.6rem 0.75rem', fontSize:'0.8rem', lineHeight:1.5 }}>
              <span style={{ ...EMOJI, fontSize:'1.25rem', lineHeight:1.2, flexShrink:0 }} aria-hidden="true">{it.ic}</span><span>{it.text}</span>
            </div>))}
        </div>
        {items.length > 4 && <button type="button" onClick={() => setMore(m => !m)} style={{ marginTop:10, background:'none', border:'none', color:'#B5541C', cursor:'pointer', fontSize:'0.8rem', fontFamily:'inherit', padding:0, fontWeight:600 }}>{more ? (en ? 'Show less ▲' : 'Thu gọn ▲') : (en ? `Show ${items.length - 4} more ▼` : `Xem thêm ${items.length - 4} gợi ý ▼`)}</button>}
        {stale && <div style={{ fontSize:'0.68rem', color:'#6b665a', marginTop:8 }}>{en ? 'Saved forecast (offline) — may be out of date.' : '📴 Dự báo đã lưu trên máy (offline) — có thể đã cũ.'}</div>}
      </div>
    </section>
  )
}
