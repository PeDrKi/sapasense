import type { DayForecast } from './forecast'

export interface Packing { outfit: string; items: string[] }

/** Clothing + gear advice from the day's forecast (and optionally the current temperature). General guidance, not a guarantee. */
export function packingAdvice(day: Pick<DayForecast, 'tMax' | 'tMin' | 'rainProb' | 'rainMm' | 'code' | 'uv' | 'wind'>, opts: { en?: boolean; limitedFitness?: boolean; motionSick?: boolean } = {}): Packing {
  const en = !!opts.en
  const T = (vi: string, e: string) => en ? e : vi
  const items: string[] = []
  const { tMax, tMin, rainProb, rainMm, uv, wind, code } = day

  let outfit: string
  if (tMin <= 5)       outfit = T('Rất lạnh: áo giữ nhiệt + áo len + áo khoác dày chống gió, mũ len, găng tay.', 'Very cold: thermal layer + sweater + thick windproof jacket, beanie, gloves.')
  else if (tMin <= 10) outfit = T('Lạnh: áo len/áo khoác dày, quần dài; mang thêm khăn quàng.', 'Cold: sweater or thick jacket, long trousers; bring a scarf.')
  else if (tMin <= 16) outfit = T('Se lạnh: áo dài tay + áo khoác mỏng, quần dài. Buổi sáng sớm và tối lạnh hơn.', 'Cool: long sleeves + light jacket, long trousers. Mornings and evenings are colder.')
  else if (tMax >= 26) outfit = T('Ấm: áo thoáng, mang thêm 1 áo mỏng cho buổi tối.', 'Warm: breathable top, plus a thin layer for the evening.')
  else                 outfit = T('Mát: áo phông/áo dài tay mỏng và 1 áo khoác nhẹ.', 'Mild: tee or thin long sleeves and a light jacket.')
  if (tMax - tMin >= 8) items.push(T('Chênh lệch nhiệt độ ngày–đêm lớn: mặc nhiều lớp, dễ cởi bớt.', 'Big day–night swing: dress in layers.'))

  const rainy = rainProb >= 50 || rainMm >= 2 || [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code)
  if (rainy) {
    items.push(T(`Có khả năng mưa (${rainProb}%): áo mưa mỏng hoặc ô; giày chống trơn; túi chống nước cho điện thoại.`, `Rain likely (${rainProb}%): rain poncho or umbrella; non-slip shoes; waterproof phone pouch.`))
    items.push(T('Mang thêm 1 đôi tất khô.', 'Pack a spare pair of dry socks.'))
  } else if (rainProb >= 25) items.push(T(`Mưa rải rác có thể xảy ra (${rainProb}%): mang ô gấp nhỏ gọn.`, `Scattered showers possible (${rainProb}%): carry a compact umbrella.`))
  if (uv >= 6) items.push(T('Chỉ số UV cao: kem chống nắng, mũ, kính râm (nắng vùng núi gắt hơn bạn nghĩ).', 'High UV: sunscreen, hat, sunglasses.'))
  if (wind >= 30) items.push(T('Gió mạnh: áo khoác chống gió, buộc gọn tóc/mũ.', 'Strong wind: windproof jacket.'))
  if (code === 45 || code === 48) items.push(T('Có sương mù: mang đèn pin nhỏ, mặc đồ sáng màu, đi chậm trên đường đèo.', 'Fog: small flashlight, bright clothes, go slowly on mountain roads.'))
  items.push(T('Giày đế bám tốt (bậc thang và đường dốc thường trơn), nước uống, pin dự phòng.', 'Grippy shoes (steps and slopes get slippery), water, power bank.'))
  if (opts.motionSick) items.push(T('Đường đèo nhiều cua: ăn nhẹ trước khi đi, ngồi ghế trước, mở cửa kính; cần thuốc say xe thì hỏi dược sĩ.', 'Winding roads: eat light, sit in front, open a window; ask a pharmacist about motion-sickness medicine.'))
  if (opts.limitedFitness) items.push(T('Mang gậy/ba toong gấp gọn nếu đi bộ dốc, nghỉ thường xuyên.', 'A folding walking stick helps on slopes; rest often.'))
  return { outfit, items }
}
