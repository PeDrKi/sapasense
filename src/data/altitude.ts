/** Rough elevation (m) per area — coarse estimates for a lapse-rate hint, NOT surveyed values. */
export const AREA_ELEVATION: Record<string, number> = {
  'Trung tâm Sa Pa': 1500,
  'Fansipan Sapa': 1500,
  'Thác Tình Yêu': 1500,
  'VQG Hoàng Liên': 1600,
  'Núi Ngũ Chỉ Sơn': 1900,
  'Đèo Ô Quý Hồ': 2000,
  'Hồ Séo Mý Tỷ': 1800,
  'Bản Tả Phìn': 1400,
  'Bản Cát Cát': 1200,
  'Bản Tả Van': 1100,
  'Bản Hồ': 900,
  'Bản Nậm Cang': 1300,
  'Bản Mòng': 1600,
  'Bản Sín Chải': 1600,
  'Quốc lộ 4D': 1500,
  'KK Sapa Hotel': 1500,
}
export const BASE_ELEVATION = 1500          // Sa Pa town, where the weather reading is taken
export const LAPSE_C_PER_100M = 0.6

export function estimateTemp(area: string, baseTemp: number): number | null {
  const el = AREA_ELEVATION[area]
  if (el === undefined || !Number.isFinite(baseTemp)) return null
  return Math.round((baseTemp - ((el - BASE_ELEVATION) / 100) * LAPSE_C_PER_100M) * 10) / 10
}
