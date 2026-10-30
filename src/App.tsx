import { useState, useEffect, lazy, Suspense } from 'react'
import WelcomeScreen    from './screens/WelcomeScreen'
import { decodePlan }   from './utils/share'
import { inferAnswers } from './utils/infer'
import { validOrigin }  from './utils/recommend'
const ExploreScreen = lazy(() => import('./screens/ExploreScreen'))
const MapPreviewScreen = lazy(() => import('./screens/MapPreviewScreen'))
import OnboardScreen    from './screens/OnboardScreen'
import ResultScreen     from './screens/ResultScreen'
import Disclaimer from './components/Disclaimer'
const AdminScreen = lazy(() => import('./screens/AdminScreen'))
import MineScreen       from './screens/MineScreen'
import WeatherBadge     from './components/WeatherBadge'
import { WX_MAP }       from './data/constants'
import { startAutoSync } from './utils/sync'
import { refreshRemotePlaces } from './data/placeStore'
import type { Answers, Weather } from './types'
import './styles/global.css'

const isAdminUrl = () => window.location.hash === '#admin' || /\/admin\/?$/.test(window.location.pathname)
type Page = 'welcome' | 'explore' | 'map-preview' | 'onboard' | 'result' | 'mine' | 'admin'

const SS_KEY = 'ss_session'
const LAST_KEY = 'ss_last'
function loadLast(): Answers | null {
  try {
    const a = JSON.parse(localStorage.getItem(LAST_KEY) || 'null')
    if (a && a.mood && a.time && a.group && Number.isInteger(a.budget)) return { mood:a.mood, budget:a.budget, time:a.time, group:a.group, mode:a.mode === 'local' ? 'local' : 'tourist', focus:['food', 'cafe'].includes(a.focus) ? a.focus : 'all' }
  } catch { /* ignore */ }
  return null
}
function saveLast(a: Answers) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify({ mood:a.mood, budget:a.budget, time:a.time, group:a.group, mode:a.mode, focus:a.focus || 'all' })) } catch { /* ignore */ }
}

function loadShared() {
  try { return decodePlan(window.location.hash) } catch { return null }
}
function loadSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SS_KEY) || 'null')
    if (s && s.page === 'result' && s.answers) return s
  } catch { /* ignore */ }
  return null
}
function saveSession(page: Page, answers: Answers | null) {
  try {
    if (page === 'result' && answers) sessionStorage.setItem(SS_KEY, JSON.stringify({ page, answers }))
    else sessionStorage.removeItem(SS_KEY)
  } catch { /* ignore */ }
}

export default function App() {
  const [shared,  setShared]  = useState(loadShared)
  const [init]                = useState(loadSession)
  const [page,    setPage]    = useState<Page>(isAdminUrl() ? 'admin' : shared ? 'result' : (init?.page || 'welcome'))
  const [answers, setAnswers] = useState<Answers | null>(shared?.answers || init?.answers || null)
  const [wx,      setWx]      = useState<Weather | null>(null)

  useEffect(() => { saveSession(page, answers) }, [page, answers])
  useEffect(() => startAutoSync(), [])
  useEffect(() => { refreshRemotePlaces() }, [])

  // Fetch Sa Pa weather on mount and refresh every 30 minutes
  useEffect(() => {
    const load = async () => {
      try {
        const res  = await fetch('https://api.open-meteo.com/v1/forecast?latitude=22.3364&longitude=103.8438&current_weather=true&timezone=Asia%2FBangkok')
        if (!res.ok) throw new Error('weather ' + res.status)
        const data = await res.json()
        const code = data.current_weather.weathercode
        const temp = Math.round(data.current_weather.temperature)
        setWx(prev => (prev && prev.code === code && prev.temp === temp)
          ? prev
          : { ...(WX_MAP[code as keyof typeof WX_MAP] || { icon:'🌤', label:'Bình thường' }), temp, code })
      } catch {
        setWx(prev => prev || { icon:'🌤', label:'Sa Pa', temp:'--' })
      }
    }
    load()
    const id = setInterval(load, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Ctrl+Shift+1 (hoặc Ctrl+Shift+A) → trang quản trị; không có nút hiển thị cho người dùng
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.ctrlKey && e.shiftKey && (e.code === 'Digit1' || e.code === 'KeyA')) { e.preventDefault(); setPage('admin') } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const goOnboard = () => setPage('onboard')
  const goResult  = (ans: Answers) => { saveLast(ans); setShared(null); setAnswers(ans); setPage('result') }
  const goQuick   = () => {
    setShared(null); setAnswers(inferAnswers({ now: new Date(), wx, last: loadLast() })); setPage('result')
    // refine with the position only if the browser already has permission — never prompts by itself
    try {
      navigator.permissions?.query({ name:'geolocation' }).then(st => {
        if (st.state !== 'granted') return
        navigator.geolocation.getCurrentPosition(pos => {
          const loc = { lat:pos.coords.latitude, lng:pos.coords.longitude, src:'gps' as const }
          if (validOrigin(loc)) setAnswers(a => a && a.auto ? { ...a, loc } : a)
        }, () => {}, { timeout:4000, maximumAge:300000 })
      }).catch(() => {})
    } catch { /* ignore */ }
  }
  const adjust    = (patch: Partial<Answers>) => setAnswers(a => (a ? { ...a, ...patch, auto:false } : a))
  const goRestart = () => { try { window.history.replaceState(null, '', window.location.pathname) } catch { /* ignore */ } setShared(null); setAnswers(null); setPage('onboard') }
  const goHome    = () => {
    try { if (isAdminUrl()) window.history.replaceState(null, '', window.location.pathname.replace(/\/admin\/?$/, '/') || '/') } catch { /* ignore */ }
    setPage('welcome')
  }
  const goMap     = () => setPage('map-preview')
  const goExplore = () => setPage('explore')
  const goMine    = () => setPage('mine')

  // result page already shows the weather in its header; badge would cover the PDF / restart buttons
  const showWeather = page === 'welcome' || page === 'onboard'

  return (
    <>
      {showWeather && <WeatherBadge wx={wx}/>}

      {page === 'welcome'     && <WelcomeScreen    onStart={goOnboard}   onMap={goMap} onExplore={goExplore} onQuick={goQuick} onMine={goMine}/>}
      {page === 'explore'     && <Suspense fallback={<div style={{ padding:'3rem', textAlign:'center' }}>…</div>}><ExploreScreen wx={wx} onHome={goHome} onPlan={goQuick}/></Suspense>}
      {page === 'map-preview' && <Suspense fallback={<div style={{ padding:'3rem', textAlign:'center' }}>…</div>}><MapPreviewScreen onStart={goOnboard} onHome={goHome}/></Suspense>}
      {page === 'onboard'     && <OnboardScreen    onDone={goResult} initial={loadLast()}/>}
      {page === 'result'      && answers && <ResultScreen answers={answers} wx={wx} onRestart={goRestart} onAdjust={adjust} shared={shared ? { ids:shared.ids, startHour:shared.startHour, dateISO:shared.dateISO } : null}/>}
      {page === 'mine'        && <MineScreen onHome={goHome}/>}
      {page !== 'admin' && page !== 'map-preview' && <Disclaimer/>}
      {page === 'admin'       && <Suspense fallback={null}><AdminScreen onExit={goHome}/></Suspense>}
    </>
  )
}
