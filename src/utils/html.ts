const MAP: Record<string, string> = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }
export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => MAP[c])
}
