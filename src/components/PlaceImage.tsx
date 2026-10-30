import { useState } from 'react'
import { photoUrl } from '../utils/photo'

/** Ảnh địa điểm; tự ẩn khi chưa có file / lỗi tải. */
export default function PlaceImage({ place, height = 150, credit }: { place: { id: string; name: string; img?: string | null }; height?: number; credit?: string | null }) {
  const [bad, setBad] = useState(false)
  const [alt, setAlt] = useState(0)   // thử lần lượt .webp → .jpg → .png khi file mặc định không có
  if (bad) return null
  const exts = ['.jpg', '.png']
  const src0 = photoUrl(place)
  const src = alt > 0 ? src0.replace(/\.webp$/, exts[alt - 1]) : src0
  return (
    <figure style={{ margin:'0 0 8px', position:'relative' }}>
      <img src={src} alt={place.name} loading="lazy" decoding="async" onError={() => (alt < exts.length && /\.webp$/.test(src0)) ? setAlt(alt + 1) : setBad(true)}
        style={{ width:'100%', height, objectFit:'cover', display:'block', background:'#E8E1D3' }}/>
      {credit && <figcaption style={{ position:'absolute', right:0, bottom:0, fontSize:'0.58rem', color:'#fff', background:'rgba(0,0,0,0.5)', padding:'1px 5px' }}>{credit}</figcaption>}
    </figure>
  )
}
