import type { Weather } from '../types'
import { safetyAdvice } from '../utils/safety'
import { C } from '../styles/tokens'

export default function SafetyNote({ wx }: { wx: Weather | null | undefined }) {
  const s = safetyAdvice(wx)
  if (!s) return null
  const col = s.level === 'danger' ? '#A83D3D' : s.level === 'warn' ? '#B85C2A' : '#2A7BA8'
  return (
    <div role="alert" style={{ display:'flex', gap:10, alignItems:'flex-start', background:`${col}14`, border:`1px solid ${col}55`, borderLeft:`4px solid ${col}`, padding:'0.65rem 0.85rem', fontSize:'0.8rem', color:C.ink, lineHeight:1.5 }}>
      <span aria-hidden style={{ fontSize:'1.1rem' }}>{s.icon}</span><span>{s.text}</span>
    </div>
  )
}
