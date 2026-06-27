export function money(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(n)
}

export function monthLabel(ym: string): string {
  // "2024-03" -> "Mar 2024"
  const [y, m] = ym.split('-')
  if (!y || !m) return ym
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}
