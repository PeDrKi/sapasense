import type { MenuEntry, MenuItem, RawPlace, Place, PriceQuality } from '../types'
// Menu-based pricing for food & cafe places.
// cost = average price of the listed menu items (rounded to 1.000đ) — "giá trung bình của menu".
// Only prices that were actually found in a published source are listed here. Nothing is invented:
// a place with no sourced menu keeps a clearly-labelled estimate (priceQuality:'est') until someone fills it in.
//
//   MENUS[id] = { items:[{ n:'Phở bò tái', p:65000 }, …], src:['https://…'], checked:'2026-10', q:'menu'|'partial', note:'…' }
//     q 'menu'    = ≥4 priced items from a published price list dated within ~1 year
//     q 'partial' = fewer items, or prices from customer reviews / older than 1 year → shown as approximate
//   To add or update a place: add/replace its entry, run the tests, done (cost & badges follow automatically).

export const MENUS: Record<string, MenuEntry> = {
  // Chưa có thực đơn Sa Pa nào được kiểm chứng nguồn — các quán ăn dùng giá ước tính từ file Excel (hiển thị nhãn "Ước tính").
}

export function menuAverage(items?: MenuItem[] | null): number {
  const ps = (items || []).map(i => +i.p).filter((p: number) => Number.isFinite(p) && p > 0)
  if (!ps.length) return 0
  return Math.round(ps.reduce((a, b) => a + b, 0) / ps.length / 1000) * 1000
}

const fmtVnd = (n: number) => n.toLocaleString('vi-VN') + 'đ'
const PRICE_BADGE = /^(TB menu |Ước tính )?~?[\d.]+(\.\d+)?đ/

/**
 * food/cafe places get a priceQuality:
 *   'menu'    – cost is the average of a published menu
 *   'partial' – average of a few / review-based prices (approximate)
 *   'est'     – no sourced menu yet, cost is an editorial estimate (labelled as such)
 */
export function applyMenus(places: RawPlace[], menus: Record<string, MenuEntry> = MENUS): Place[] {
  return places.map(p => {
    if (p.type !== 'food' && p.type !== 'cafe') return p as Place
    const m = menus[p.id]
    const avg = m?.items?.length ? menuAverage(m.items) : 0
    const rest = (p.badges || []).filter(b => !PRICE_BADGE.test(b))
    if (!avg) return { ...p, priceQuality:'est', badges:[`Ước tính ~${fmtVnd(p.cost)}`, ...rest] }
    const q: PriceQuality = m.q === 'menu' && m.items.length >= 4 ? 'menu' : 'partial'
    const label = q === 'menu' ? `TB menu ~${fmtVnd(avg)}` : `TB ~${fmtVnd(avg)} (menu chưa đủ)`
    return { ...p, cost:avg, priceQuality:q, menu:m.items, menuSrc:m.src || [], menuChecked:m.checked || '', menuNote:m.note || '', badges:[label, ...rest] }
  })
}
