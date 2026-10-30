import type { Weather } from '../types'
import { isRainyCode } from './recommend'

export interface Safety { level: 'danger' | 'warn' | 'info'; icon: string; text: string }

/**
 * Lời khuyên an toàn theo thời tiết hiện tại tại Sa Pa (mã thời tiết Open-Meteo + nhiệt độ).
 * Chỉ dựa trên dữ liệu thời tiết thật đang có; không có dữ liệu thì không cảnh báo.
 */
export function safetyAdvice(wx: Weather | null | undefined): Safety | null {
  if (!wx || wx.code == null) return null
  const code = wx.code, temp = typeof wx.temp === 'number' ? wx.temp : Number(wx.temp)
  if ([95, 96, 99].includes(code)) return { level:'danger', icon:'⛈', text:'Có giông: tránh đèo, đỉnh núi và trekking; ở trong nhà cho đến khi tạnh.' }
  if (isRainyCode(code)) return { level:'warn', icon:'🌧', text:'Trời mưa: đường đèo và đường rừng trơn, nên hoãn trekking (Ngũ Chỉ Sơn, Séo Mý Tỷ) và chọn điểm trong nhà.' }
  if (code === 45 || code === 48) return { level:'warn', icon:'🌫', text:'Sương mù dày: tầm nhìn thấp trên đèo, đi chậm, bật đèn và tránh lên đỉnh cao.' }
  if (Number.isFinite(temp) && temp <= 8) return { level:'warn', icon:'🥶', text:`Rét đậm (${temp}°C), có thể có băng giá: mang áo ấm, găng tay, chú ý trơn trượt.` }
  if (Number.isFinite(temp) && temp <= 14) return { level:'info', icon:'🧥', text:`Trời lạnh (${temp}°C): mang áo khoác, buổi sáng sớm và tối còn lạnh hơn.` }
  return null
}
