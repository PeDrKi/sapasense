import type { Answers, Plan } from '../types'

const KEY = 'ss_plan'
export interface SavedPlan { answers: Answers; ids: string[]; startHour?: number; dateISO?: string; savedAt: number }

/** Remember the last plan so it can be reopened later with no network (plans are computed in the browser). */
export function savePlan(answers: Answers, plan: Plan): void {
  try {
    if (!plan.stops?.length) return
    const s: SavedPlan = { answers, ids: plan.stops.map(x => x.id), startHour: plan.startHour, dateISO: plan.dateISO, savedAt: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch { /* storage unavailable */ }
}

export function loadSavedPlan(): SavedPlan | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (s && Array.isArray(s.ids) && s.ids.length && s.answers?.mood && s.answers?.time) return s as SavedPlan
  } catch { /* ignore */ }
  return null
}
