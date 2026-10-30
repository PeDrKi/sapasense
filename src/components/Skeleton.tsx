import type { CSSProperties } from 'react'
import { C } from '../styles/tokens'

type Size = string | number

export function SkeletonLine({ width='100%', height=14, style={} }: { width?: Size; height?: Size; style?: CSSProperties }) {
  return <div className="skeleton" style={{ width, height, borderRadius:3, ...style }}/>
}

export function SkeletonBlock({ width='100%', height=80, style={} }: { width?: Size; height?: Size; style?: CSSProperties }) {
  return <div className="skeleton" style={{ width, height, borderRadius:3, ...style }}/>
}

export function SkeletonCard({ delay=0 }: { delay?: number }) {
  return (
    <div style={{
      background:C.card, border:`1px solid ${C.border}`, padding:'0.95rem',
      display:'flex', gap:'0.85rem',
      opacity:0, animation:`fadeUp 0.35s ease ${delay}s forwards`,
    }}>
      <div className="skeleton" style={{ width:30, height:30, flexShrink:0, borderRadius:2 }}/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
        <SkeletonLine width="55%" height={13}/>
        <SkeletonLine width="30%" height={10}/>
        <SkeletonLine width="90%" height={11}/>
        <SkeletonLine width="70%" height={11}/>
        <div style={{ display:'flex', gap:6, marginTop:2 }}>
          <SkeletonLine width={70} height={18} style={{ borderRadius:2 }}/>
          <SkeletonLine width={55} height={18} style={{ borderRadius:2 }}/>
          <SkeletonLine width={65} height={18} style={{ borderRadius:2 }}/>
        </div>
      </div>
    </div>
  )
}

export function SkeletonList({ count=4 }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
      <div style={{ borderLeft:`2px solid ${C.border}`, paddingLeft:'1rem', marginBottom:'0.25rem', display:'flex', flexDirection:'column', gap:6 }}>
        <SkeletonLine width="80%" height={12}/>
        <SkeletonLine width="55%" height={12}/>
      </div>
      <div style={{ display:'flex', gap:4, borderBottom:`1px solid ${C.border}`, paddingBottom:'0.6rem', marginBottom:'0.25rem' }}>
        {['45%','40%','55%','35%'].map((w,i) => (
          <SkeletonLine key={i} width={w} height={10} style={{ maxWidth:90 }}/>
        ))}
      </div>
      {Array.from({length:count}).map((_,i) => (
        <SkeletonCard key={i} delay={i*0.08}/>
      ))}
    </div>
  )
}

export function SkeletonResultHeader() {
  return (
    <div style={{ padding:'1.4rem 1.75rem 1.1rem', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'1rem' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
        <SkeletonLine width="45%" height={18}/>
        <SkeletonLine width="30%" height={10}/>
        <div style={{ display:'flex', gap:6, marginTop:2 }}>
          {['25%','20%','22%','18%'].map((w,i) => (
            <SkeletonLine key={i} width={w} height={16} style={{ maxWidth:80, borderRadius:2 }}/>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', gap:8, flexShrink:0 }}>
        <SkeletonBlock width={64} height={32} style={{ borderRadius:2 }}/>
        <SkeletonBlock width={72} height={32} style={{ borderRadius:2 }}/>
      </div>
    </div>
  )
}

export function SkeletonMap() {
  return (
    <div style={{ position:'relative', width:'100%', height:'100%', background:C.card, overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gridTemplateRows:'repeat(3,1fr)', gap:2, padding:2 }}>
        {Array.from({length:12}).map((_,i) => (
          <div key={i} className="skeleton" style={{ borderRadius:2, animationDelay:`${(i*0.07).toFixed(2)}s` }}/>
        ))}
      </div>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
        <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(244,239,230,0.9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>🗺</div>
        <div style={{ fontSize:'0.78rem', color:C.muted, background:'rgba(244,239,230,0.9)', padding:'0.3rem 0.8rem', borderRadius:3 }}>Đang tải bản đồ...</div>
      </div>
    </div>
  )
}
