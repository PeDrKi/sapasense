/**
 * Ảnh địa điểm. Thứ tự ưu tiên:
 *  1. place.img là URL đầy đủ (https://…) hoặc đường dẫn tuyệt đối → dùng nguyên;
 *  2. place.img là tên file trong public/places/ (vd "SP002.webp");
 *  3. không có img → public/places/<ID>.webp (vd public/places/SP002.webp).
 * Nếu file không tồn tại, ảnh tự ẩn (không hiện ô vỡ).
 */
export function photoUrl(p: { id: string; img?: string | null }): string {
  const img = (p.img || '').trim()
  if (/^(https?:)?\/\//.test(img) || img.startsWith('data:')) return img
  const base = (import.meta.env.BASE_URL || './').replace(/\/?$/, '/')
  return base + 'places/' + (img || p.id + '.webp').replace(/^\/?places\//, '')
}
