// Chưa có dữ liệu phỏng vấn thực địa Sa Pa trong dự án: để trống, không dùng số liệu mẫu.
// Khi có phiếu khảo sát, điền vào B1_SUMMARY và INTERVIEWS (cấu trúc giữ nguyên).
export const B1_SUMMARY = {
  totalInterviewed: 0,
  period: '',
  demographics: { domestic:0, international:0, local:0, avgAge:0 },
  groupTypes: { solo:0, couple:0, friends:0, family:0 },
  budgetDistribution: { under200k:0, from200to500k:0, from500kto1m:0, over1m:0 },
  moodDistribution: { calm:0, adventure:0, nostalgia:0, energy:0 },
  wouldUseApp: { yes:0, no:0 },
  topProblems: [] as { problem: string; count: number }[],
  topPlaces: [] as { name: string; mentions: number }[],
  keyInsights: [] as string[],
  scoringWeights: { mood:0.35, group:0.25, budget:0.25, timeOfDay:0.15 },
}

export const INTERVIEWS: Array<{ id:string; date:string; location:string; profile:{ age:number; gender:string; job:string; origin:string; type:string }; answers:Record<string, any> }> = []
