import { useState, type CSSProperties, type ReactNode } from 'react'

interface BtnProps { className?: string; children?: ReactNode; onClick?: () => void; disabled?: boolean; style?: CSSProperties }
import { C } from '../styles/tokens'

export function Grain() {
  return (
    <div aria-hidden="true" style={{
      position:'fixed', inset:0, pointerEvents:'none', zIndex:0, opacity:.4,
      backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
    }}/>
  )
}

export function StepBar({ step, total=4 }: { step: number; total?: number }) {
  return (
    <div style={{ display:'flex', gap:6, marginBottom:'2.5rem' }}>
      {Array.from({length:total}).map((_,i) => (
        <div key={i} style={{ flex:1, height:2, transition:'background 0.4s', background: i<=step ? C.rust : C.border }}/>
      ))}
    </div>
  )
}

export function BtnPrimary({ children, onClick, disabled, style={}, className }: BtnProps) {
  const [hov, setHov] = useState(false)
  return (
    <button className={className} onClick={disabled ? undefined : onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov && !disabled ? C.rust : C.ink,
        color: C.cream, border:'none',
        padding:'0.85rem 1.6rem', fontSize:'0.87rem',
        fontFamily:"'Be Vietnam Pro',sans-serif", fontWeight:500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        letterSpacing:'0.05em', transition:'all 0.2s',
        opacity: disabled ? 0.4 : 1,
        transform: hov && !disabled ? 'translateY(-1px)' : 'none',
        ...style,
      }}>
      {children}
    </button>
  )
}

export function BtnSecondary({ children, onClick, style={} }: BtnProps) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background:'transparent', color: hov ? C.ink : C.muted,
        border:`1px solid ${hov ? C.ink : C.border}`,
        padding:'0.85rem 1.4rem', fontSize:'0.87rem',
        fontFamily:"'Be Vietnam Pro',sans-serif",
        cursor:'pointer', transition:'all 0.2s', ...style,
      }}>
      {children}
    </button>
  )
}
