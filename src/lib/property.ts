// Turns a property's logged entries (+ acquisition config) into the numbers the
// dashboards show: cash flow, NOI, cap rate, cash-on-cash, the 1% / 50% rules,
// and breakdowns by month and category. All client-side, no rounding surprises.
import type { Property, PropertyConfig, PropertyEntry } from '../../shared/types'

// Expense categories that are FINANCING (the mortgage), not operating costs.
// NOI and cap rate exclude these; cash flow includes them.
function isFinancing(category: string): boolean {
  const c = category.toLowerCase()
  return c.includes('mortgage') || c.includes('loan') || c.includes('principal')
}

// Security deposits are refundable — held money, not income. Kept separate from
// all profit/cash-flow math.
function isDeposit(category: string): boolean {
  return category.toLowerCase().includes('deposit')
}

export interface PropertyStats {
  totalIncome: number
  totalExpenses: number
  net: number // all-time income - expenses
  unpaidIncome: number // scheduled rent not yet marked paid
  depositsHeld: number // refundable security deposits collected (NOT income)
  fixedMonthly: number // recurring fixed costs per month
  monthsTracked: number
  avgMonthlyIncome: number
  avgMonthlyExpense: number
  avgMonthlyCashFlow: number
  annualIncome: number
  annualExpenses: number
  annualCashFlow: number
  annualNOI: number // net operating income (excludes mortgage)
  purchasePrice: number
  cashInvested: number
  capRate: number // % — annual NOI / purchase price
  cashOnCash: number // % — annual cash flow / cash invested
  onePctRule: number // % — avg monthly rent / purchase price
  fiftyPctRule: number // % — operating expenses / income
  byMonth: { month: string; income: number; expense: number; net: number }[]
  byCategory: { category: string; amount: number }[] // expenses only
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  if (!ay || !am || !by || !bm) return 1
  return (by - ay) * 12 + (bm - am) + 1
}

export function cashInvestedOf(config: PropertyConfig): number {
  const price = config.purchasePrice ?? 0
  const closing = config.closingCosts ?? 0
  const rehab = config.rehab ?? 0
  // Owned free & clear: your capital tied up is the whole property + costs, so
  // cash-on-cash is the return on the full amount you have sitting in it.
  if (config.paidOff) return price + closing + rehab
  const down = config.downPayment ?? 0
  const total = down + closing + rehab
  // Fall back to full purchase price if no financing details were entered.
  return total > 0 ? total : price
}

export function computePropertyStats(entries: PropertyEntry[], config: PropertyConfig): PropertyStats {
  let totalIncome = 0
  let totalExpenses = 0
  let opExpenses = 0 // operating only (excludes mortgage)
  let unpaidIncome = 0
  let depositsHeld = 0
  const months = new Map<string, { income: number; expense: number }>()
  const cats = new Map<string, number>()

  for (const e of entries) {
    const amt = Math.abs(e.amount)
    const ym = (e.entry_date || '').slice(0, 7) || 'unknown'
    // Unpaid rows (scheduled rent not yet collected) don't count as realized.
    if (e.paid === 0) {
      if (e.kind === 'income' && !isDeposit(e.category)) unpaidIncome += amt
      continue
    }
    // Refundable deposits: track separately, keep out of income & cash flow.
    if (e.kind === 'income' && isDeposit(e.category)) {
      depositsHeld += amt
      continue
    }
    const m = months.get(ym) ?? { income: 0, expense: 0 }
    if (e.kind === 'income') {
      totalIncome += amt
      m.income += amt
    } else {
      totalExpenses += amt
      m.expense += amt
      if (!isFinancing(e.category)) opExpenses += amt
      const c = e.category || 'Uncategorized'
      cats.set(c, (cats.get(c) ?? 0) + amt)
    }
    months.set(ym, m)
  }

  const dates = entries.map((e) => e.entry_date).filter(Boolean).sort()
  const monthsTracked = dates.length ? monthsBetween(dates[0], dates[dates.length - 1]) : 0
  const div = monthsTracked || 1

  // Fixed recurring costs apply every tracked month — fold them into totals,
  // the per-month series, and the category breakdown so everything stays
  // consistent (they're "auto-added").
  const fixedCosts = config.fixedCosts ?? []
  const fixedMonthly = fixedCosts.reduce((t, fc) => t + (Number(fc.amount) || 0), 0)
  if (fixedMonthly > 0 && monthsTracked > 0) {
    for (const fc of fixedCosts) {
      const amt = (Number(fc.amount) || 0) * monthsTracked
      if (amt <= 0) continue
      totalExpenses += amt
      if (!isFinancing(fc.category)) opExpenses += amt
      const c = fc.category || 'Fixed cost'
      cats.set(c, (cats.get(c) ?? 0) + amt)
    }
    for (const [, v] of months) v.expense += fixedMonthly
  }

  const avgMonthlyIncome = totalIncome / div
  const avgMonthlyExpense = totalExpenses / div
  const avgMonthlyCashFlow = avgMonthlyIncome - avgMonthlyExpense
  const annualIncome = avgMonthlyIncome * 12
  const annualExpenses = avgMonthlyExpense * 12
  const annualCashFlow = avgMonthlyCashFlow * 12
  const annualNOI = (totalIncome - opExpenses) / div * 12

  const purchasePrice = config.purchasePrice ?? 0
  const cashInvested = cashInvestedOf(config)

  return {
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
    unpaidIncome,
    depositsHeld,
    fixedMonthly,
    monthsTracked,
    avgMonthlyIncome,
    avgMonthlyExpense,
    avgMonthlyCashFlow,
    annualIncome,
    annualExpenses,
    annualCashFlow,
    annualNOI,
    purchasePrice,
    cashInvested,
    capRate: purchasePrice > 0 ? (annualNOI / purchasePrice) * 100 : 0,
    cashOnCash: cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0,
    onePctRule: purchasePrice > 0 ? (avgMonthlyIncome / purchasePrice) * 100 : 0,
    fiftyPctRule: totalIncome > 0 ? (opExpenses / totalIncome) * 100 : 0,
    byMonth: [...months.entries()]
      .filter(([m]) => m !== 'unknown')
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, income: v.income, expense: v.expense, net: v.income - v.expense })),
    byCategory: [...cats.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({ category, amount })),
  }
}

export interface PortfolioStats {
  count: number
  totalIncome: number
  totalExpenses: number
  net: number
  annualCashFlow: number
  annualNOI: number
  totalPurchasePrice: number
  totalCashInvested: number
  capRate: number
  cashOnCash: number
}

// Roll a set of per-property stats up into one portfolio summary.
export function aggregatePortfolio(
  items: { property: Property; stats: PropertyStats }[],
): PortfolioStats {
  const s = items.reduce(
    (acc, { stats }) => {
      acc.totalIncome += stats.totalIncome
      acc.totalExpenses += stats.totalExpenses
      acc.annualCashFlow += stats.annualCashFlow
      acc.annualNOI += stats.annualNOI
      acc.totalPurchasePrice += stats.purchasePrice
      acc.totalCashInvested += stats.cashInvested
      return acc
    },
    {
      totalIncome: 0,
      totalExpenses: 0,
      annualCashFlow: 0,
      annualNOI: 0,
      totalPurchasePrice: 0,
      totalCashInvested: 0,
    },
  )
  return {
    count: items.length,
    totalIncome: s.totalIncome,
    totalExpenses: s.totalExpenses,
    net: s.totalIncome - s.totalExpenses,
    annualCashFlow: s.annualCashFlow,
    annualNOI: s.annualNOI,
    totalPurchasePrice: s.totalPurchasePrice,
    totalCashInvested: s.totalCashInvested,
    capRate: s.totalPurchasePrice > 0 ? (s.annualNOI / s.totalPurchasePrice) * 100 : 0,
    cashOnCash: s.totalCashInvested > 0 ? (s.annualCashFlow / s.totalCashInvested) * 100 : 0,
  }
}
