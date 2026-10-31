import { useRef, useState } from 'react'
import { photoUrl } from '../utils/photo'

const canHover = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover)').matches

/** Ảnh địa điểm: mặc định hiện một phần (cắt gọn); rê chuột vào hoặc chạm vào thì mở rộng toàn bộ ảnh. Tự ẩn khi chưa có file / lỗi tải. */
export default function PlaceImage({ place, height = 150, credit }: { place: { id: string; name: string; img?: string | null }; height?: number; credit?: string | null }) {
  const [bad, setBad] = useState(false)
  const [alt, setAlt] = useState(0)   // thử lần lượt .webp → .jpg → .png khi file mặc định không có
  const [open, setOpen] = useState(false)
  const [ratio, setRatio] = useState(0)   // naturalHeight / naturalWidth
  const fig = useRef<HTMLElement>(null)
  if (bad) return null
  const exts = ['.jpg', '.png']
  const src0 = photoUrl(place)
  const src = alt > 0 ? src0.replace(/\.webp$/, exts[alt - 1]) : src0
  const fullH = ratio && fig.current ? Math.min(Math.round(fig.current.clientWidth * ratio), 640) : height
  const shown = open ? Math.max(fullH, height) : height
  const canExpand = fullH > height + 4
  return (
    <figure ref={fig} style={{ margin:'0 0 8px', position:'relative', cursor: canExpand ? 'zoom-in' : 'default' }}
      onMouseEnter={() => { if (canHover()) setOpen(true) }} onMouseLeave={() => { if (canHover()) setOpen(false) }}
      onClick={() => { if (!canHover()) setOpen(o => !o) }}>
      <img src={src} alt={place.name} loading="lazy" decoding="async"
        onLoad={e => { const i = e.currentTarget; if (i.naturalWidth) setRatio(i.naturalHeight / i.naturalWidth) }}
        onError={() => (alt < exts.length && /\.webp$/.test(src0)) ? setAlt(alt + 1) : setBad(true)}
        style={{ width:'100%', height:shown, objectFit: open ? 'contain' : 'cover', display:'block', background:'#E8E1D3', transition:'height 0.3s ease' }}/>
      {canExpand && <span aria-hidden="true" style={{ position:'absolute', left:0, bottom:0, fontSize:'0.6rem', color:'#fff', background:'rgba(0,0,0,0.5)', padding:'1px 6px', opacity: open ? 0 : 1, transition:'opacity 0.2s' }}>⤢ Xem toàn ảnh</span>}
      {credit && <figcaption style={{ position:'absolute', right:0, bottom:0, fontSize:'0.58rem', color:'#fff', background:'rgba(0,0,0,0.5)', padding:'1px 5px' }}>{credit}</figcaption>}
    </figure>
  )
}
