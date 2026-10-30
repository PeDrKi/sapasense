import { C }    from '../styles/tokens'
import { useT } from '../i18n'
import type { Weather } from '../types'

export default function WeatherBadge({ wx }: { wx: Weather | null }) {
  const t = useT()
  return (
    <div style={{
      position:'fixed', top:'1.25rem', right:'1.25rem', zIndex:2000,
      background:'rgba(244,239,230,0.92)', backdropFilter:'blur(8px)',
      border:`1px solid ${C.border}`, padding:'0.4rem 0.9rem',
      fontSize:'0.75rem', color:C.muted,
    }}>
      {wx ? `${wx.icon} ${wx.temp}°C · ${wx.label}` : t.weather.loading}
    </div>
  )
}
