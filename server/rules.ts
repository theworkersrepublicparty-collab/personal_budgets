// Manual categorization rules. A rule is a keyword -> category that YOU write.
// We only MATCH descriptions against your rules — nothing is ever guessed or
// auto-derived. Used to apply your rules to blank rows and to fresh imports.

// Given a description and your rules dict, return the matching category (or
// null). The longest matching keyword wins, so more specific rules beat generic
// ones (e.g. "amazon prime" beats "amazon").
export function matchCategory(
  description: string,
  rules: Record<string, string>,
): string | null {
  const d = String(description).toLowerCase()
  let best: string | null = null
  let bestLen = 0
  for (const [keyword, category] of Object.entries(rules)) {
    const k = keyword.toLowerCase()
    if (k && d.includes(k) && k.length > bestLen) {
      best = category
      bestLen = k.length
    }
  }
  return best
}
