import { useEffect, useState } from 'react'
import { fetchForecast, type DayForecast } from '../utils/forecast'
import { packingAdvice } from '../utils/packing'
import { useLang } from '../i18n'
import type { Weather } from '../types'
import { WX_MAP } from '../data/constants'

const C = { border:'#E3DCCB', muted:'#6b665a', card:'#fff' }
const dayName = (iso: string, en: boolean) => new Date(iso + 'T12:00:00').toLocaleDateString(en ? 'en-GB' : 'vi-VN', { weekday:'short', day:'numeric', month:'numeric' })

/** Thời tiết hiện tại + dự báo vài ngày + gợi ý trang phục / vật dụng cho ngày đi. */
export default function WeatherPanel({ wx, dateISO, limitedFitness, motionSick }: { wx: Weather | null; dateISO?: string; limitedFitness?: boolean; motionSick?: boolean }) {
  const { lang } = useLang(); const en = lang === 'EN'
  const [days, setDays] = useState<DayForecast[]>([]); const [stale, setStale] = useState(false); const [loaded, setLoaded] = useState(false)
  useEffect(() => { let on = true; fetchForecast().then(r => { if (on) { setDays(r.days); setStale(r.stale); setLoaded(true) } }); return () => { on = false } }, [])
  const day = days.find(d => d.date === dateISO) || days[0]
  if (!loaded) return null
  if (!day) return <div style={{ fontSize:'0.75rem', color:C.muted, marginBottom:'1rem' }}>{en ? 'Forecast unavailable (offline). Check the weather before you go.' : 'Chưa có dự báo (đang mất mạng). Hãy kiểm tra thời tiết trước khi đi.'}</div>
  const adv = packingAdvice(day, { en, limitedFitness, motionSick })
  const icon = (c: number) => (WX_MAP as Record<number, { icon: string }>)[c]?.icon || '🌤'
  return (
    <section aria-label={en ? 'Weather and packing' : 'Thời tiết và đồ mang theo'} style={{ background:C.card, border:`1px solid ${C.border}`, padding:'0.9rem 1rem', marginBottom:'1.25rem' }}>
      <div style={{ fontWeight:600, fontSize:'0.88rem', marginBottom:6 }}>🧳 {en ? 'Weather & what to bring' : 'Thời tiết & nên mang gì'}</div>
      {wx && wx.temp !== undefined && wx.temp !== '--' && <div style={{ fontSize:'0.8rem', marginBottom:8 }}>{en ? 'Now' : 'Hiện tại'}: {wx.icon} {wx.temp}°C · {wx.label}{wx.precip ? ` · ${wx.precip} mm` : ''}</div>}
      <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:10 }}>
        {days.map(d => (
          <div key={d.date} style={{ minWidth:78, textAlign:'center', padding:'0.4rem 0.3rem', border:`1px solid ${d.date === day.date ? '#B5541C' : C.border}`, fontSize:'0.72rem' }}>
            <div style={{ color:C.muted }}>{dayName(d.date, en)}</div>
            <div style={{ fontSize:'1.15rem' }}>{icon(d.code)}</div>
            <div style={{ fontWeight:600 }}>{d.tMin}°–{d.tMax}°</div>
            <div style={{ color:C.muted }}>☔ {d.rainProb}%</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize:'0.8rem', lineHeight:1.6, marginBottom:4 }}><strong>{en ? 'Wear: ' : 'Nên mặc: '}</strong>{adv.outfit}</div>
      <ul style={{ margin:'4px 0 0', paddingLeft:'1.1rem', fontSize:'0.78rem', lineHeight:1.6, color:C.muted }}>{adv.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
      {stale && <div style={{ fontSize:'0.68rem', color:C.muted, marginTop:6 }}>{en ? 'Saved forecast (offline) — may be out of date.' : 'Dự báo đã lưu trên máy (offline) — có thể đã cũ.'}</div>}
    </section>
  )
}
