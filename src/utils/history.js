/** Saved triage results, read from localStorage. A corrupted entry gives an empty history instead of a crash. */
export function readHistory() {
  try {
    const history = JSON.parse(localStorage.getItem('triageHistory') || '[]')
    return Array.isArray(history) ? history : []
  } catch {
    return []
  }
}
