export function money(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(n)
}

export function shortDate(iso: string): string {
  // "2026-07-03" -> "Jul 3, 2026". Parsed as local time to avoid TZ drift.
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function monthLabel(ym: string): string {
  // "2024-03" -> "Mar 2024"
  const [y, m] = ym.split('-')
  if (!y || !m) return ym
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}
