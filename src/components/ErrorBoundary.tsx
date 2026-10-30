import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Catches render errors so the user never sees a blank page; offers a clean restart. */
export default class ErrorBoundary extends Component<{ children?: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('App error:', error, info.componentStack) }
  reset = () => {
    try { sessionStorage.clear(); window.history.replaceState(null, '', window.location.pathname) } catch { /* ignore */ }
    window.location.reload()
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:'2rem', textAlign:'center', background:'#F4EFE6', color:'#1A1916', fontFamily:"'Be Vietnam Pro',sans-serif" }}>
        <div style={{ fontSize:'2rem' }}>🧭</div>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.4rem' }}>Có gì đó trục trặc / Something went wrong</h1>
        <p style={{ fontSize:'0.88rem', color:'#7A746E', maxWidth:380 }}>Lộ trình của bạn không hiển thị được. Hãy thử lại từ đầu — chúng tôi đã xóa dữ liệu phiên bị lỗi.</p>
        <button onClick={this.reset} style={{ background:'#1A1916', color:'#F4EFE6', border:'none', padding:'0.8rem 1.6rem', cursor:'pointer', fontSize:'0.9rem' }}>Bắt đầu lại / Restart</button>
      </div>
    )
  }
}
