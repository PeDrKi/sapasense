import type { Place } from '../types'

export interface SeasonInfo { bestMonths: number[]; season: string }
export const SEASONS_DATA: Record<string, SeasonInfo> = {
  SP001:{bestMonths:[10,11,12,1,2,3,4],season:'Đẹp nhất tháng 10–12 săn mây và tháng 2–4 mùa hoa đỗ quyên, chọn ngày nắng ráo. Tránh tuyệt đối ngày mưa bão.'},
  SP002:{bestMonths:[1,2,3,4,5,9,10,11,12],season:'Tháng 9–11 lúa chín trời trong; tháng 12–2 săn băng tuyết; tháng 3–5 mùa đỗ quyên. Tránh mùa mưa lũ tháng 6–8.'},
  SP003:{bestMonths:[9,10,11,12,1,2,3,4],season:'Đi ngày nắng ráo tháng 9–4. Tránh mùa mưa vì đường đèo đá hộc trơn dốc.'},
  SP004:{bestMonths:[9, 10, 11, 12, 1, 2, 3, 4],season:"Tháng 9–10 ruộng lúa chín; tháng 3–4 hoa đào mận nở; mùa lạnh hợp tắm lá thuốc Dao đỏ. Tránh ngày mưa to vì đường trơn. (Tham khảo chung — xem dự báo trước khi đi.)"},
  SP005:{bestMonths:[4, 5, 6, 9, 10],season:"Tháng 5–6 và tháng 9–10 nước thác đẹp, đường ít nguy hiểm. Tránh giông bão tháng 7–8 vì đường đi trơn. (Tham khảo chung — xem dự báo trước khi đi.)"},
  SP020:{bestMonths:[6, 7, 9, 10, 11],season:"Tháng 9–10 lúa chín vàng (đẹp nhất); tháng 6–7 ruộng xanh mướt nhưng hay mưa, mang áo mưa. Tháng 12–2 ruộng trơ gốc, trời rét. (Tham khảo chung — xem dự báo trước khi đi.)"},
  SP021:{bestMonths:[6, 7, 9, 10, 11],season:"Tháng 9–10 lúa chín vàng (đẹp nhất); tháng 6–7 ruộng xanh mướt nhưng hay mưa, mang áo mưa. Tháng 12–2 ruộng trơ gốc, trời rét. (Tham khảo chung — xem dự báo trước khi đi.)"},
  CF001:{bestMonths:[6, 7, 9, 10, 11],season:"Tháng 9–10 lúa chín vàng (đẹp nhất); tháng 6–7 ruộng xanh mướt nhưng hay mưa, mang áo mưa. Tháng 12–2 ruộng trơ gốc, trời rét. (Tham khảo chung — xem dự báo trước khi đi.)"},
  CF002:{bestMonths:[6, 7, 9, 10, 11],season:"Tháng 9–10 lúa chín vàng (đẹp nhất); tháng 6–7 ruộng xanh mướt nhưng hay mưa, mang áo mưa. Tháng 12–2 ruộng trơ gốc, trời rét. (Tham khảo chung — xem dự báo trước khi đi.)"},
  CF003:{bestMonths:[6, 7, 9, 10, 11],season:"Tháng 9–10 lúa chín vàng (đẹp nhất); tháng 6–7 ruộng xanh mướt nhưng hay mưa, mang áo mưa. Tháng 12–2 ruộng trơ gốc, trời rét. (Tham khảo chung — xem dự báo trước khi đi.)"},
  AM017:{bestMonths:[6, 7, 9, 10, 11],season:"Tháng 9–10 lúa chín vàng (đẹp nhất); tháng 6–7 ruộng xanh mướt nhưng hay mưa, mang áo mưa. Tháng 12–2 ruộng trơ gốc, trời rét. (Tham khảo chung — xem dự báo trước khi đi.)"},
  AM016:{bestMonths:[6, 7, 9, 10, 11],season:"Tháng 9–10 lúa chín vàng (đẹp nhất); tháng 6–7 ruộng xanh mướt nhưng hay mưa, mang áo mưa. Tháng 12–2 ruộng trơ gốc, trời rét. (Tham khảo chung — xem dự báo trước khi đi.)"},
  SP022:{bestMonths:[1, 2, 3, 4, 9, 10, 11, 12],season:"Hoạt động trong nhà nên đi được quanh năm; tháng 9–10 kết hợp ngắm lúa chín quanh bản. Tránh Tết Nguyên Đán vì nghỉ. (Tham khảo chung — xem dự báo trước khi đi.)"},
  SP023:{bestMonths:[9, 10, 11, 12, 1, 2, 3, 4, 5],season:"Tháng 9–12 trời trong, nhìn thung lũng rõ nhất. Tránh tháng 6–8 vì mưa giông, máng trượt ngừng chạy. (Tham khảo chung — xem dự báo trước khi đi.)"},
  SP026:{bestMonths:[10, 11, 12, 1, 2, 3],season:"Tháng 10–3 trời lạnh, tắm lá thuốc và spa đặc biệt dễ chịu. Đặt lịch trước vào dịp lễ. (Tham khảo chung — xem dự báo trước khi đi.)"},
  SP027:{bestMonths:[9, 10, 11, 3, 4],season:"Tháng 9–11 lúa chín và săn mây; tháng 3–4 hoa nở. Tránh ngày mưa vì đường bản dốc, trơn. (Tham khảo chung — xem dự báo trước khi đi.)"},
  SP028:{bestMonths:[9, 10, 11, 3, 4, 5],season:"Tháng 9–11 săn mây và ngắm thung lũng lúa chín; tháng 3–5 trời quang. Tránh ngày mưa mù. (Tham khảo chung — xem dự báo trước khi đi.)"},
  SP029:{bestMonths:[11, 12, 1, 2],season:"Tháng 11–2 mai anh đào nở dọc đồi chè Ô Long, đẹp nhất quanh Tết; sáng sớm có mây trên đồi. (Tham khảo chung — xem dự báo trước khi đi.)"},
  SP030:{bestMonths:[5, 6, 9, 10],season:"Tháng 5–6 và tháng 9–10 thác đủ nước, đường đi ít nguy hiểm. Tránh giông bão tháng 7–8, bậc thang ẩm trơn. (Tham khảo chung — xem dự báo trước khi đi.)"},
  SP031:{bestMonths:[9, 10, 11, 12, 1, 2, 3],season:"Tháng 10–12 là mùa săn mây, ngày nắng trong thấy trọn đèo. Tránh tháng 6–8 vì mưa, sương che hết tầm nhìn. (Tham khảo chung — xem dự báo trước khi đi.)"},
  SP032:{bestMonths:[3, 4, 5, 9, 10, 11],season:"Tháng 3–5 hoa nở, tháng 9–11 trời trong đẹp nhất để chụp ảnh. Tránh ngày mưa vì tiểu cảnh ngoài trời. (Tham khảo chung — xem dự báo trước khi đi.)"},
  CF004:{bestMonths:[3, 4, 5, 9, 10, 11],season:"Tháng 3–5 và tháng 9–11 trời dễ chịu cho khu nông trại ngoài trời. Tránh ngày mưa to. (Tham khảo chung — xem dự báo trước khi đi.)"},
  AM007:{bestMonths:[10, 11, 12, 1, 2, 3],season:"Tháng 10–3 trời lạnh hợp ăn đồ nướng bên hồ. Tránh mùa mưa lũ vì đường tới hồ trơn. (Tham khảo chung — xem dự báo trước khi đi.)"},
  AM013:{bestMonths:[10, 11, 12, 1, 2, 3],season:"Tháng 10–3 trời lạnh, quán nướng than hồng ngoài trời ấm và đông khách. (Tham khảo chung — xem dự báo trước khi đi.)"},
}

export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter'
export const SEASON_LABELS: Record<SeasonKey, { icon: string; desc: string }> = {
  spring: { icon:'🌸', desc:'Ẩm, hoa nở, mưa phùn nhẹ' },
  summer: { icon:'☀️', desc:'Nóng ẩm, mưa rào chiều' },
  autumn: { icon:'🍂', desc:'Đẹp nhất, mát mẻ, khô ráo' },
  winter: { icon:'❄️', desc:'Lạnh khô, sương mù' },
}

export function getCurrentSeason(month: number): SeasonKey {
  if ([2,3,4].includes(month)) return 'spring'
  if ([5,6,7,8].includes(month)) return 'summer'
  if ([9,10,11].includes(month)) return 'autumn'
  return 'winter'
}

export function mergeSeasonsIntoPlaces(places: Place[]): Place[] {
  return places.map(p => ({
    ...p,
    bestMonths: SEASONS_DATA[p.id]?.bestMonths || [1,2,3,4,5,6,7,8,9,10,11,12],
    peakMonths: SEASONS_DATA[p.id] ? peakMonthsOf(p.id) : [],
    season:     SEASONS_DATA[p.id]?.season     || 'Phù hợp quanh năm.',
  }))
}

/**
 * Peak months = months the season text singles out ("tháng 10-11", "(9-11)", "tháng 8-9: …").
 * Falls back to bestMonths when the text names none, so every place has a peak set.
 * Always a subset of bestMonths.
 */
export function peakMonthsOf(id: string): number[] {
  const d = SEASONS_DATA[id]
  if (!d) return []
  const text = d.season || ''
  const found = new Set<number>()
  const re = /(?:tháng\s*|\()(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?/gi
  let m
  while ((m = re.exec(text))) {
    const a = +m[1], b = m[2] ? +m[2] : a
    if (a < 1 || a > 12 || b < 1 || b > 12) continue
    // ranges that wrap the year (12-1) are walked forward
    for (let x = a, n = 0; n < 12; n++, x = x % 12 + 1) { found.add(x); if (x === b) break }
  }
  // season words ("mùa thu", "thu-đông", "trời lạnh") — skipped in clauses that warn against a season
  const WORDS: [RegExp, number[]][] = [[/thu/i, [9, 10, 11]], [/đông|lạnh|se lạnh/i, [12, 1, 2]], [/xuân/i, [2, 3, 4]], [/\bhè\b/i, [5, 6, 7, 8]]]
  for (const clause of text.split(/[.;—]/)) {
    if (/tránh|ít người mua|không phụ thuộc|quanh năm|mọi mùa/i.test(clause)) continue
    for (const [rx, months] of WORDS) if (rx.test(clause)) months.forEach(x => found.add(x))
  }
  const peak = [...found].filter(x => d.bestMonths.includes(x))
  return peak.length ? peak.sort((x, y) => x - y) : d.bestMonths
}

/** 'peak' = this month is singled out for the place; 'ok' = fine but not special; 'off' = better another month. */
export function seasonLevel(id: string, month: number): 'peak' | 'ok' | 'off' {
  const d = SEASONS_DATA[id]
  if (!d) return 'ok'
  if (!d.bestMonths.includes(month)) return 'off'
  const peak = peakMonthsOf(id)
  return peak.length < d.bestMonths.length && peak.includes(month) ? 'peak' : 'ok'
}
