import { useLang } from '../i18n'

export default function LangToggle({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useLang()
  return (
    <div className="lang-toggle"
      style={{ borderColor: dark ? 'rgba(255,255,255,0.25)' : 'rgba(26,25,22,0.13)' }}>
      {(['VI','EN'] as const).map(l => (
        <button key={l} onClick={() => setLang(l)}
          className={lang === l ? 'active' : ''}
          style={{
            color: lang === l
              ? (dark ? 'white' : '#1A1916')
              : (dark ? 'rgba(255,255,255,0.5)' : '#7A746E'),
            background: lang === l
              ? (dark ? 'rgba(255,255,255,0.18)' : 'rgba(26,25,22,0.1)')
              : 'none',
          }}>
          {l}
        </button>
      ))}
    </div>
  )
}
