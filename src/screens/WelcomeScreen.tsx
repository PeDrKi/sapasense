import { Grain, BtnPrimary } from '../components/ui'
import LangToggle            from '../components/LangToggle'
import { C }                 from '../styles/tokens'
import { useT, useLang }     from '../i18n'
import { useState, useRef, useLayoutEffect } from 'react'
import { gsap, reducedMotion, EASE } from '../utils/motion'
import { getPlaces }         from '../data/placeStore'
import { hiddenCount, clearHidden, favIds } from '../utils/memory'

interface Props { onStart: () => void; onAdmin?: () => void; onMap: () => void; onExplore?: () => void; onQuick?: () => void; onMine: () => void; onSaved?: () => void }

export default function WelcomeScreen({ onStart, onMap, onExplore, onQuick, onMine, onSaved }: Props) {
  const t = useT().welcome
  const { lang } = useLang()
  const [hid, setHid] = useState(hiddenCount)
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (reducedMotion()) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: EASE } })
      tl.from('.w-logo', { scale: 0, rotate: -180, opacity: 0, duration: 0.9, ease: 'back.out(1.7)' })
        .from('.w-eyebrow', { y: 14, opacity: 0, duration: 0.5 }, '-=0.45')
        .from('.w-line', { yPercent: 110, opacity: 0, duration: 0.8, stagger: 0.12 }, '-=0.3')
        .from('.w-sub', { y: 16, opacity: 0, duration: 0.6 }, '-=0.4')
        .from('.w-btn', { y: 18, opacity: 0, duration: 0.5, stagger: 0.08 }, '-=0.35')
      gsap.to('.w-logo', { rotate: 360, duration: 24, ease: 'none', repeat: -1, delay: 1 })
      gsap.to('.w-orb', { y: -14, x: 8, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.8 })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={root} style={{ minHeight:'100vh', background:C.cream, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', textAlign:'center', position:'relative' }}>
      <Grain/>
      <div style={{ position:'fixed', top:'1.25rem', left:'1.25rem', zIndex:100 }}>
        <LangToggle/>
      </div>
      <div className="w-orb" style={{ position:'absolute', top:'10%', left:'7%', width:110, height:110, borderRadius:'50%', border:`1px solid ${C.border}`, opacity:.45 }}/>
      <div className="w-orb" style={{ position:'absolute', bottom:'12%', right:'8%', width:72, height:72, borderRadius:'50%', border:`1px solid ${C.border}`, opacity:.35 }}/>
      <div className="w-logo" style={{ position:'relative', zIndex:1, width:56, height:56, borderRadius:'50%', border:`2px solid ${C.ink}`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Playfair Display',serif", fontSize:18, marginBottom:'2rem' }}>ss</div>
      <p className="w-eyebrow" style={{ position:'relative', zIndex:1, fontSize:'0.68rem', letterSpacing:'0.22em', textTransform:'uppercase', color:C.muted, marginBottom:'1rem' }}>{t.eyebrow}</p>
      <h1 className="welcome-title" style={{ position:'relative', zIndex:1, fontFamily:"'Playfair Display',serif", fontSize:'clamp(2.8rem,9vw,4.8rem)', lineHeight:1.02, marginBottom:'1.5rem' }}>
        <span style={{ display:'block', overflow:'hidden', paddingBottom:'0.08em' }}><span className="w-line" style={{ display:'block' }}>{t.title1}</span></span>
        <span style={{ display:'block', overflow:'hidden', paddingBottom:'0.08em' }}><em className="w-line" style={{ display:'block', color:C.rust, fontStyle:'italic' }}>{t.title2}</em></span>
        <span style={{ display:'block', overflow:'hidden', paddingBottom:'0.08em' }}><span className="w-line" style={{ display:'block' }}>{t.title3}</span></span>
      </h1>
      <p className="w-sub" style={{ position:'relative', zIndex:1, fontSize:'0.92rem', color:C.muted, maxWidth:340, margin:'0 auto 3rem', lineHeight:1.8, whiteSpace:'pre-line' }}>{t.subtitle}</p>
      {onQuick
        ? <BtnPrimary onClick={onQuick} className="w-btn" style={{ position:'relative', zIndex:1 }}>{t.quickCta}</BtnPrimary>
        : <BtnPrimary onClick={onStart} className="w-btn" style={{ position:'relative', zIndex:1 }}>{t.cta}</BtnPrimary>}
      {onQuick && (
        <button className="w-btn" onClick={onStart} style={{ position:'relative', zIndex:1, marginTop:'0.9rem', background:'none', border:`1px solid ${C.border}`, color:C.ink, cursor:'pointer', fontSize:'0.88rem', padding:'0.65rem 1.4rem', fontFamily:"'Be Vietnam Pro',sans-serif" }}>
          {t.pickCta}
        </button>
      )}
      {onSaved && (
        <button type="button" className="w-btn" onClick={onSaved} style={{ position:'relative', zIndex:1, marginTop:'0.9rem', background:'none', border:'none', color:C.ink, cursor:'pointer', fontSize:'0.82rem', textDecoration:'underline', fontFamily:"'Be Vietnam Pro',sans-serif" }}>{lang === 'EN' ? '📴 Reopen last saved plan (works offline)' : '📴 Mở lại lộ trình đã lưu (xem được khi mất mạng)'}</button>
      )}
      {onExplore && (
        <button type="button" className="w-btn" onClick={onExplore} style={{ position:'relative', zIndex:1, marginTop:'0.9rem', background:'none', border:'none', color:C.ink, cursor:'pointer', fontSize:'0.82rem', textDecoration:'underline', fontFamily:"'Be Vietnam Pro',sans-serif" }}>{lang === 'EN' ? '🧭 Explore places' : '🧭 Khám phá địa điểm'}</button>
      )}
      {onMine && (
        <button type="button" className="w-btn" onClick={onMine} style={{ position:'relative', zIndex:1, marginTop:'0.9rem', background:'none', border:'none', color:C.ink, cursor:'pointer', fontSize:'0.82rem', textDecoration:'underline', fontFamily:"'Be Vietnam Pro',sans-serif" }}>{t.mineLink(favIds().length)}</button>
      )}
      {hid > 0 && (
        <button type="button" onClick={() => { clearHidden(); setHid(0) }} style={{ position:'relative', zIndex:1, marginTop:'0.9rem', background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:'0.76rem', textDecoration:'underline', fontFamily:"'Be Vietnam Pro',sans-serif" }}>{t.unhide(hid)}</button>
      )}
      {onMap && (
        <button className="w-btn" onClick={onMap} style={{ position:'relative', zIndex:1, marginTop:'1.1rem', background:'none', border:'none', cursor:'pointer', fontSize:'0.82rem', color:C.rust, textDecoration:'underline', fontFamily:"'Be Vietnam Pro',sans-serif" }}>
          {t.mapLink(getPlaces().length)}
        </button>
      )}
    </div>
  )
}
