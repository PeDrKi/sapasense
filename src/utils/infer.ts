import { isRainyCode } from './recommend'
import type { Answers, Weather, Mood } from '../types'

/**
 * Guess what kind of plan the user wants without asking: from the clock, the day of the week, the weather,
 * and (when there is one) their last choices. `why` lists the signals so the UI can explain itself.
 */
export function inferAnswers({ now = new Date(), wx = null, last = null }: { now?: Date; wx?: Weather | null; last?: Partial<Answers> | null } = {}): Answers & { why: string[] } {
  const hour = now.getHours() + now.getMinutes() / 60
  const dow = now.getDay()
  const weekend = dow === 0 || dow === 6
  const rainy = isRainyCode(wx?.code ?? 0)
  const hot = Number(wx?.temp) >= 35
  const why: string[] = []
  // without a strong signal rotate through the moods by date so a frequent user does not see the same kind of plan every day
  const doy = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 0)) / 86400000)
  const rot: Mood[] = ['calm', 'nostalgia', 'adventure', 'energy']
  let mood: Mood = 'calm'
  if (rainy)            { mood = 'calm'; why.push('rain') }
  else if (hot)         { mood = 'calm'; why.push('hot') }
  else if (hour >= 18)  { mood = doy % 2 ? 'adventure' : 'energy'; why.push('evening') }
  else if (weekend)     { mood = doy % 2 ? 'adventure' : 'energy'; why.push('weekend') }
  else if (hour < 10)   { mood = doy % 2 ? 'nostalgia' : 'calm'; why.push('morning') }
  else                  { mood = rot[doy % 4] }
  if (!why.length) why.push('now')
  return {
    mood,
    time: hour >= 19 ? '2h' : 'half',
    budget: typeof last?.budget === 'number' && Number.isInteger(last.budget) ? last.budget : 3,
    group: last?.group || 'any',
    mode: last?.mode === 'local' ? 'local' : 'tourist',
    focus: 'all',
    auto: true,
    why,
  }
}
