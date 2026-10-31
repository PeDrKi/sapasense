import { useState, useRef, useLayoutEffect } from 'react'
import { gsap, reducedMotion, EASE } from '../utils/motion'
import { Grain, StepBar,
         BtnPrimary, BtnSecondary } from '../components/ui'
import LangToggle                from '../components/LangToggle'
import { C }                     from '../styles/tokens'
import { useT }                  from '../i18n'
import { BUDGET_MIN, BUDGET_MAX, BUDGET_PRESETS, normalizeBudget, formatVnd, parseBudgetInput, clampBudget, sliderToBudget, budgetToSlider } from '../utils/budget'
import { AREA_PRESETS, validOrigin } from '../utils/recommend'
import { reverseGeocode } from '../utils/geocode'
import { useLang } from '../i18n'
import { getPlaces }              from '../data/placeStore'
import type { Answers, Loc, Mode, Focus, TimeId } from '../types'

function OptionCard({ icon, label, desc, selected, onSelect }: { icon: string; label: string; desc: string; selected: boolean; onSelect: () => void }) {
  return (
    <div onClick={onSelect} role="radio" aria-checked={!!selected} tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      style={{ background:selected?C.rustLight:C.card, border:`1px solid ${selected?C.rust:C.border}`, padding:'0.9rem 1.1rem', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:'0.8rem', transition:'background-color 0.18s, border-color 0.18s' }}>
      <span style={{ fontSize:'1.2rem', flexShrink:0, lineHeight:1.5 }}>{icon}</span>
      <div>
        <div style={{ fontWeight:600, fontSize:'0.88rem', marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:'0.75rem', color:C.muted }}>{desc}</div>
      </div>
    </div>
  )
}

function LocationPicker({ ob, loc, onChange }: { ob: ReturnType<typeof useT>['onboard']; loc?: Loc | null; onChange: (l: Loc | null) => void }) {
  const [state, setState] = useState<'idle' | 'asking' | 'denied' | 'outside' | 'unsupported'>('idle')   // idle | asking | denied | outside | unsupported
  const { lang } = useLang()
  const [addr, setAddr] = useState<{ state:'idle'|'loading'|'ok'|'fail'; text?: string }>({ state:'idle' })
  const lookup = async () => {
    if (!loc || loc.src !== 'gps') return
    setAddr({ state:'loading' })
    const a = await reverseGeocode(loc.lat, loc.lng, lang === 'EN' ? 'en' : 'vi')
    setAddr(a ? { state:'ok', text:a.short } : { state:'fail' })
  }
  const areas = [['trungtam', ob.areaCenter], ['hoanglien', ob.areaHoangLien], ['ngochison', ob.areaNguChiSon], ['taphin', ob.areaTaPhin], ['seomyty', ob.areaSeoMyTy]]
  const ask = () => {
    if (!navigator.geolocation) { setState('unsupported'); return }
    setState('asking')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const l = { lat:pos.coords.latitude, lng:pos.coords.longitude }
        if (!validOrigin(l)) { setState('outside'); onChange(null); return }
        setState('idle'); onChange({ ...l, src:'gps' })
      },
      () => { setState('denied') },
      { enableHighAccuracy:false, timeout:8000, maximumAge:300000 })
  }
  const chip = (on: boolean) => ({ fontSize:'0.76rem', padding:'0.4rem 0.8rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif", background:on?C.rustLight:C.card, color:on?C.rust:C.ink, border:`1px solid ${on?C.rust:C.border}` })
  const msg = ({ asking:ob.locAsking, denied:ob.locDenied, outside:ob.locOutside, unsupported:ob.locUnsupported } as Record<string, string>)[state]
  return (
    <div style={{ marginTop:'1rem', paddingTop:'1rem', borderTop:`1px solid ${C.border}` }}>
      <div style={{ fontSize:'0.8rem', fontWeight:600, marginBottom:6 }}>{ob.locTitle}</div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        <button type="button" onClick={ask} aria-pressed={loc?.src==='gps'} style={chip(loc?.src==='gps')}>📍 {loc?.src==='gps' ? ob.locOn : ob.locBtn}</button>
        {areas.map(([id, label]) => (
          <button type="button" key={id} aria-pressed={loc?.area===id} onClick={() => onChange(loc?.area===id ? null : { ...AREA_PRESETS[id], src:'area', area:id, label })} style={chip(loc?.area===id)}>{label}</button>
        ))}
        {loc && <button type="button" onClick={() => { onChange(null); setState('idle') }} style={{ ...chip(false), border:'none', textDecoration:'underline', color:C.muted }}>{ob.locClear}</button>}
      </div>
      <div role="status" style={{ fontSize:'0.72rem', color:state==='idle'?C.muted:'#9A5B00', marginTop:6, lineHeight:1.5 }}>{msg || ob.locNote}</div>
      {loc?.src === 'gps' && (
        <div style={{ marginTop:8 }}>
          {addr.state !== 'ok' && <button type="button" onClick={lookup} disabled={addr.state==='loading'} style={{ ...chip(false), fontSize:'0.72rem' }}>📍 {addr.state==='loading' ? ob.addrLoading : ob.addrBtn}</button>}
          {addr.state === 'ok' && <div role="status" style={{ fontSize:'0.78rem', lineHeight:1.5 }}><b>{ob.addrYou}</b> {addr.text} <span style={{ color:C.muted, fontSize:'0.66rem' }}>· © OpenStreetMap</span></div>}
          {addr.state === 'fail' && <div role="status" style={{ fontSize:'0.72rem', color:'#9A5B00', marginTop:4 }}>{ob.addrFail}</div>}
          <div style={{ fontSize:'0.66rem', color:C.muted, marginTop:4 }}>{ob.addrNote}</div>
        </div>
      )}
    </div>
  )
}

type Draft = Omit<Answers, 'mood' | 'time' | 'group'> & { mood: Answers['mood'] | null; time: Answers['time'] | null; group: Answers['group'] | null }

export default function OnboardScreen({ onDone, initial }: { onDone: (a: Answers) => void; initial?: Partial<Answers> | null }) {
  const t  = useT()
  const ob = t.onboard
  const [step, setStep] = useState(0)
  const [ans,  setAns]  = useState<Draft>(() => ({ mood:null, budget:800000, time:null, group:null, mode:'tourist', focus:'all', ...(initial || {}) }))
  const [budgetText, setBudgetText] = useState('')
  const [budgetEditing, setBudgetEditing] = useState(false)
  const [day,  setDay]  = useState(0)        // 0 = today, 1 = tomorrow
  const [hr,   setHr]   = useState('now')    // 'now' or an hour 6..21

  const stepRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (reducedMotion() || !stepRef.current) return
    const ctx = gsap.context(() => {
      const kids = Array.from(stepRef.current!.children) as HTMLElement[]   // [step label, question, hint, body]
      gsap.from(kids.slice(0, 3), { y: 16, opacity: 0, duration: 0.45, stagger: 0.07, ease: EASE })
      if (kids[3]) gsap.from(Array.from(kids[3].children), { x: 28, opacity: 0, duration: 0.5, stagger: 0.07, ease: EASE, delay: 0.12 })
    }, stepRef)
    return () => ctx.revert()
  }, [step])

  const canNext = [true, true, !!ans.mood, true, !!ans.time, !!ans.group]
  const LAST    = canNext.length - 1
  const finish  = () => {
    const out = { ...ans } as Answers
    if (day === 1) out.dayOffset = 1
    if (hr !== 'now') out.startHour = +hr
    else if (day === 1) out.startHour = 8
    onDone(out)
  }
  const next    = () => step < LAST ? setStep(s => s+1) : finish()
  const back    = () => setStep(s => s-1)

  const { lang: curLang } = useLang()
  const budgetVnd = normalizeBudget(ans.budget)
  const budgetFull = formatVnd(budgetVnd, curLang)
  const setBudget = (n: number) => { setAns(a => ({ ...a, budget: clampBudget(n) })); setBudgetEditing(false) }
  const commitBudgetText = () => { const n = parseBudgetInput(budgetText); if (n != null) setBudget(n); else setBudgetEditing(false) }
  const shortVnd = (n: number) => n >= 1_000_000_000 ? (n / 1_000_000_000) + (curLang === 'EN' ? 'B' : ' tỷ') : n >= 1_000_000 ? (n / 1_000_000).toString().replace('.', ',') + 'M' : Math.round(n / 1000) + 'K'

  const moodIcons: Record<string, string>  = { calm:'🍃', adventure:'🗺️', nostalgia:'🕰️', energy:'⚡' }
  const groupIcons: Record<string, string> = { solo:'🧍', couple:'👫', friends:'👥', family:'👨‍👩‍👧' }
  const timeIcons: Record<string, string>  = { '2h':'☕', half:'🌤', full:'🌇' }

  const steps = [
    {
      q: ob.stepMode, hint: ob.hintMode,
      body: (
        <div style={{ paddingBottom:'1.5rem' }}>
        <div role="radiogroup" style={{ display:'grid', gap:9, marginBottom:'1.25rem' }}>
          {[
            { id:'tourist', icon:'✈️', label:ob.modeTLabel.replace('✈️ ',''), desc:ob.modeTDesc },
            { id:'local',   icon:'🏠', label:ob.modeLLabel.replace('🏠 ',''), desc:ob.modeLDesc },
          ].map(m => (
            <OptionCard key={m.id} icon={m.icon} label={m.label} desc={m.desc}
              selected={ans.mode===m.id} onSelect={() => setAns(a => ({...a, mode:m.id as Mode}))}/>
          ))}
        </div>
          <LocationPicker ob={ob} loc={ans.loc} onChange={loc => setAns(a => { const n = { ...a }; if (loc) n.loc = loc; else delete n.loc; return n })}/>
        </div>
      ),
    },
    {
      q: ob.stepFocus, hint: ob.hintFocus,
      body: (
        <div role="radiogroup" style={{ display:'grid', gap:9, marginBottom:'1.75rem' }}>
          {[
            { id:'all',  icon:'🗺️', label:ob.focusAll,  desc:ob.focusAllDesc },
            { id:'food', icon:'🍜', label:ob.focusFood, desc:ob.focusFoodDesc },
            { id:'cafe', icon:'☕', label:ob.focusCafe, desc:ob.focusCafeDesc },
          ].filter(f => f.id !== 'cafe' || getPlaces().some(p => p.type === 'cafe')).map(f => (
            <OptionCard key={f.id} icon={f.icon} label={f.label} desc={f.desc}
              selected={ans.focus===f.id} onSelect={() => setAns(a => ({...a, focus:f.id as Focus}))}/>
          ))}
        </div>
      ),
    },
    {
      q: ob.stepMood, hint: ob.hintMood,
      body: (
        <>
          <div role="radiogroup" style={{ display:'grid', gap:9, marginBottom:'1.75rem' }}>
            {(Object.entries(t.moods) as [Answers['mood'], { label: string; desc: string }][]).map(([id, {label, desc}]) => (
              <OptionCard key={id} icon={moodIcons[id]} label={label} desc={desc}
                selected={ans.mood===id} onSelect={() => setAns(a => ({...a, mood:id}))}/>
            ))}
          </div>
        </>
      ),
    },
    {
      q: ob.stepBudget, hint: ob.hintBudget,
      body: (
        <div style={{ marginBottom:'2.5rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <span style={{ fontSize:'0.82rem', color:C.muted }}>{ob.budgetLbl}</span>
            <span style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.55rem', color:C.rust }}>{budgetFull}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <input type="text" inputMode="numeric" aria-label={ob.budgetLbl}
              value={budgetEditing ? budgetText : budgetVnd.toLocaleString(curLang === 'EN' ? 'en-US' : 'vi-VN')}
              onFocus={e => { setBudgetText(String(budgetVnd)); setBudgetEditing(true); e.currentTarget.select() }}
              onChange={e => setBudgetText(e.target.value)}
              onBlur={commitBudgetText}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitBudgetText(); (e.currentTarget as HTMLInputElement).blur() } }}
              style={{ flex:1, minWidth:0, padding:'0.6rem 0.8rem', fontSize:'1rem', border:`1px solid ${C.border}`, background:C.card, color:C.ink, fontFamily:'inherit' }}/>
            <span style={{ fontSize:'0.9rem', color:C.muted }}>đ</span>
          </div>
          <input type="range" min={0} max={1000} step={1} value={budgetToSlider(budgetVnd)}
            aria-label={ob.budgetLbl} aria-valuetext={budgetFull}
            onChange={e => setBudget(sliderToBudget(+e.target.value))}
            style={{ accentColor:C.rust }}/>
          <div aria-hidden="true" style={{ position:'relative', height:16, marginTop:6, fontSize:'0.68rem', color:C.muted }}>
            {[BUDGET_MIN, 1_000_000, 10_000_000, 100_000_000, BUDGET_MAX].map((v, i, arr) => {
              const pct = budgetToSlider(v) / 10
              return <span key={v} style={{ position:'absolute', left:`${pct}%`, transform: i === 0 ? 'none' : i === arr.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)', whiteSpace:'nowrap' }}>{shortVnd(v)}</span>
            })}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:12 }}>
            {BUDGET_PRESETS.map(p => (
              <button type="button" key={p} aria-pressed={budgetVnd === p} onClick={() => setBudget(p)}
                style={{ padding:'0.35rem 0.75rem', fontSize:'0.74rem', cursor:'pointer', border:`1px solid ${budgetVnd===p?C.rust:C.border}`, background:budgetVnd===p?C.rustLight:'transparent', color:budgetVnd===p?C.rust:C.muted, fontFamily:'inherit' }}>{shortVnd(p)}</button>
            ))}
          </div>
          <div style={{ fontSize:'0.68rem', color:C.muted, marginTop:10, lineHeight:1.5 }}>{ob.budgetNote}</div>
        </div>
      ),
    },
    {
      q: ob.stepTime, hint: ob.hintTime,
      body: (
        <div role="radiogroup" style={{ display:'grid', gap:9, marginBottom:'1.75rem' }}>
          {Object.entries(t.times).map(([id, {label, desc}]) => (
            <OptionCard key={id} icon={timeIcons[id]} label={label} desc={desc}
              selected={ans.time===id} onSelect={() => setAns(a => ({...a, time:id as TimeId}))}/>
          ))}
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginTop:'0.4rem' }}>
            <label htmlFor="start-hr" style={{ fontSize:'0.8rem', color:C.muted }}>{ob.startLbl}</label>
            <select value={day} onChange={e => { const v = +e.target.value; setDay(v); if (v === 1 && hr === 'now') setHr('8') }} aria-label={ob.dayToday + ' / ' + ob.dayTomorrow}
              style={{ padding:'0.5rem 0.6rem', border:`1px solid ${C.border}`, background:C.card, fontFamily:"'Be Vietnam Pro',sans-serif", fontSize:'0.82rem' }}>
              <option value={0}>{ob.dayToday}</option>
              <option value={1}>{ob.dayTomorrow}</option>
            </select>
            <select id="start-hr" value={hr} onChange={e => setHr(e.target.value)}
              style={{ padding:'0.5rem 0.6rem', border:`1px solid ${C.border}`, background:C.card, fontFamily:"'Be Vietnam Pro',sans-serif", fontSize:'0.82rem' }}>
              {day === 0 && <option value="now">{ob.startNow}</option>}
              {Array.from({ length:16 }, (_, i) => i + 6).map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
            </select>
          </div>
        </div>
      ),
    },
    {
      q: ob.stepGroup, hint: ob.hintGroup,
      body: (
        <div role="radiogroup" style={{ display:'grid', gap:9, marginBottom:'1.75rem' }}>
          {Object.entries(t.groups).map(([id, {label, desc}]) => (
            <OptionCard key={id} icon={groupIcons[id]} label={label} desc={desc}
              selected={ans.group===id} onSelect={() => setAns(a => ({...a, group:id as Answers['group']}))}/>
          ))}
        </div>
      ),
    },
  ]

  const cur = steps[step]

  return (
    <div style={{ minHeight:'100vh', background:C.cream, display:'flex', flexDirection:'column', justifyContent:'center', padding:'2rem', position:'relative' }}>
      <Grain/>
      <div style={{ position:'fixed', top:'1.25rem', left:'1.25rem', zIndex:100 }}><LangToggle/></div>
      <div className="onboard-wrap" style={{ position:'relative', zIndex:1, maxWidth:520, margin:'0 auto', width:'100%' }}>
        <StepBar step={step} total={LAST+1}/>
        <div key={step} ref={stepRef}>
          <div style={{ fontSize:'0.68rem', letterSpacing:'0.14em', textTransform:'uppercase', color:C.muted, marginBottom:6 }}>{ob.stepOf} {step+1}/{LAST+1}</div>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(1.4rem,4vw,1.75rem)', lineHeight:1.15, marginBottom:6 }}>{cur.q}</h2>
          <p style={{ fontSize:'0.81rem', color:C.muted, marginBottom:'1.6rem' }}>{cur.hint}</p>
          {cur.body}
        </div>
        {!canNext[step] && <p role="status" style={{ fontSize:'0.75rem', color:C.muted, marginBottom:8, textAlign:'center' }}>{ob.hintPick}</p>}
        <div style={{ display:'flex', gap:10 }}>
          {step > 0 && <BtnSecondary onClick={back} style={{ flex:1, whiteSpace:'nowrap' }}>{ob.back}</BtnSecondary>}
          <BtnPrimary onClick={next} disabled={!canNext[step]} style={{ flex:2 }}>
            {step === LAST ? ob.generate : ob.next}
          </BtnPrimary>
        </div>
      </div>
    </div>
  )
}
