/**
 * Ngân sách = số tiền VND mỗi người cho một ngày, nhập tự do (số lẻ được).
 * Tương thích ngược: số nguyên 1..5 là chỉ số mức cũ (200K…3M) từ link chia sẻ / dữ liệu đã lưu.
 */
export const BUDGET_MIN = 50_000
export const BUDGET_MAX = 1_000_000_000
export const PEOPLE_MAX = 100
export const BUDGET_DEFAULT = 800_000
const LEGACY = [0, 200_000, 500_000, 800_000, 1_500_000, 3_000_000]
export const BUDGET_PRESETS = [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000, 50_000_000, 100_000_000]

/** Chỉ số mức cũ (1..5) → VND; số lớn hơn giữ nguyên (kẹp trong khoảng cho phép). */
export function normalizeBudget(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return BUDGET_DEFAULT
  if (n <= 5) return LEGACY[Math.round(n)] || BUDGET_DEFAULT
  return Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, Math.round(n)))
}

export function isValidBudget(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && ((v >= 1 && v <= 5) || (v >= BUDGET_MIN && v <= BUDGET_MAX))
}

/** 1250000 → "1.250.000đ" (VI) hoặc "1,250,000đ" (EN). */
export function formatVnd(v: unknown, lang: 'VI' | 'EN' = 'VI'): string {
  const n = normalizeBudget(v)
  return n.toLocaleString(lang === 'EN' ? 'en-US' : 'vi-VN') + 'đ'
}

/** Gõ "1.250.000", "1,25tr", "800k", "2 triệu"… → số VND, hoặc null nếu không hiểu. */
export function parseBudgetInput(s: string): number | null {
  const t = s.toLowerCase().replace(/\s+/g, '').replace(/đ|vnd|vnđ/g, '')
  if (!t) return null
  const m = t.match(/^(\d+(?:[.,]\d+)*)(k|nghìn|ngàn|tr|triệu|m)?$/)
  if (!m) return null
  const unit = m[2]
  let numStr = m[1]
  let n: number
  if (unit) {
    n = parseFloat(numStr.replace(',', '.'))           // "1,5tr" → 1.5
    n *= (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') ? 1_000 : 1_000_000
  } else {
    n = parseInt(numStr.replace(/[.,]/g, ''), 10)       // "1.250.000" → 1250000
  }
  return Number.isFinite(n) ? Math.round(n) : null
}

export const clampBudget = (n: number) => Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, Math.round(n)))

/** Thanh trượt theo thang log (0..1000) để vừa chọn nhanh mức nhỏ vừa tới hàng chục triệu. */
const LOG_RANGE = Math.log(BUDGET_MAX / BUDGET_MIN)
export function sliderToBudget(pos: number): number {
  const raw = BUDGET_MIN * Math.exp((pos / 1000) * LOG_RANGE)
  const step = raw < 1_000_000 ? 10_000 : raw < 10_000_000 ? 100_000 : 500_000
  return clampBudget(Math.round(raw / step) * step)
}
export function budgetToSlider(v: number): number {
  return Math.round((Math.log(clampBudget(v) / BUDGET_MIN) / LOG_RANGE) * 1000)
}

export const clampPeople = (n: unknown) => { const v = Math.round(Number(n)); return Number.isFinite(v) ? Math.min(PEOPLE_MAX, Math.max(1, v)) : 1 }

/** Tổng ngân sách ÷ số người = ngân sách mỗi người, dùng để lọc/chấm điểm địa điểm (không bao giờ dưới mức tối thiểu). */
export function budgetPerPerson(total: unknown, people?: number): number {
  const t = normalizeBudget(total)
  return Math.max(BUDGET_MIN, Math.round(t / clampPeople(people)))
}
