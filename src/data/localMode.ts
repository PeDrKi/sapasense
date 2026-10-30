import type { Place, Mode } from '../types'

export interface LocalInfo { localScore: number; hiddenGem: boolean; touristDesc: string; localDesc: string; localTip: string; localTime: string }
export const LOCAL_MODE: Record<string, LocalInfo> = {
  // Chưa có dữ liệu "góc nhìn người địa phương" cho Sa Pa. Thêm theo mẫu:
  // SP004:{localScore:4,hiddenGem:false,touristDesc:'…',localDesc:'…',localTip:'…',localTime:'07:00 - 09:00'},
}

export function mergeLocalMode(places: Place[], mode: Mode = 'tourist'): Place[] {
  return places.map(p => {
    const lm = LOCAL_MODE[p.id]
    if (!lm) return p
    return {
      ...p,
      localScore:  lm.localScore,
      hiddenGem:   lm.hiddenGem || false,
      desc:        mode === 'local' ? lm.localDesc    : lm.touristDesc,
      tip:         mode === 'local' ? lm.localTip     : p.tip,
      displayTime: mode === 'local' ? lm.localTime    : null,
    }
  })
}
