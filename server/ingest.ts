// Turns parsed file rows + a column mapping into normalized transactions.
// This is the heart of the "instance creator": any file shape becomes the same
// canonical { date, description, amount, direction, ... } via the mapping.
import { createHash } from 'node:crypto'
import type { ColumnMapping } from '../shared/types.ts'

export interface NormalizedTxn {
  txn_date: string
  description: string
  amount: number // signed: + = money in, - = money out
  direction: 'in' | 'out'
  category: string | null
  section: string | null
  dedupe_hash: string
  raw_row: string
}

// --- amount parsing -------------------------------------------------------
// Handles "$1,234.56", "(45.00)" (parens = negative), "-12.30", "12.30 CR" etc.
export function parseAmount(raw: string | undefined | null): number {
  if (raw == null) return 0
  let s = String(raw).trim()
  if (s === '') return 0
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (/-/.test(s)) negative = true
  if (/\bCR\b/i.test(s)) negative = false // credit marker => positive
  if (/\bDR\b/i.test(s)) negative = true
  // strip everything that isn't a digit or decimal point
  const num = parseFloat(s.replace(/[^0-9.]/g, ''))
  if (isNaN(num)) return 0
  return negative ? -Math.abs(num) : Math.abs(num)
}

// --- date parsing ---------------------------------------------------------
// Returns ISO YYYY-MM-DD. Tolerant of the common bank formats. Defaults to
// US-style MM/DD/YYYY when the order is ambiguous.
export function parseDate(raw: string | undefined | null): string {
  if (raw == null) return ''
  const s = String(raw).trim()
  if (s === '') return ''

  // Already ISO?
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  // Numeric separators: M/D/Y or D/M/Y or with - or .
  const parts = s.split(/[/\-.]/).map((p) => p.trim())
  if (parts.length === 3) {
    let [a, b, c] = parts
    if (c.length === 4) {
      // a,b are day/month in some order, c is year. Assume US MM/DD/YYYY.
      const month = Number(a)
      const day = Number(b)
      const year = Number(c)
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
      // fall back to D/M/Y
      return `${year}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`
    }
    if (a.length === 4) {
      // YYYY/MM/DD
      return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`
    }
  }

  // Last resort: let JS try (handles "Jan 5, 2024" etc.).
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return s // give back original if unparseable; user can see it in the table
}

// --- normalize one row ----------------------------------------------------
export function normalizeRow(row: Record<string, string>, m: ColumnMapping): NormalizedTxn | null {
  const txn_date = m.date ? parseDate(row[m.date]) : ''
  const description = m.description ? String(row[m.description] ?? '').trim() : ''

  let amount = 0
  if (m.amountMode === 'debitcredit') {
    const debit = m.debit ? Math.abs(parseAmount(row[m.debit])) : 0
    const credit = m.credit ? Math.abs(parseAmount(row[m.credit])) : 0
    // credit = money in (+), debit = money out (-)
    amount = credit - debit
  } else {
    const raw = m.amount ? parseAmount(row[m.amount]) : 0
    // positiveMeans tells us how to interpret a positive number in the file.
    amount = m.positiveMeans === 'in' ? raw : -raw
  }

  // A row with neither a date nor an amount is junk (e.g. summary line).
  if (!txn_date && amount === 0) return null

  const direction: 'in' | 'out' = amount >= 0 ? 'in' : 'out'
  const category = m.category ? String(row[m.category] ?? '').trim() || null : null
  const section = m.section ? String(row[m.section] ?? '').trim() || null : null

  const dedupe_hash = createHash('sha1')
    .update(`${txn_date}|${amount.toFixed(2)}|${description.toLowerCase()}`)
    .digest('hex')

  return {
    txn_date,
    description,
    amount,
    direction,
    category,
    section,
    dedupe_hash,
    raw_row: JSON.stringify(row),
  }
}

// --- auto-guess a mapping from headers ------------------------------------
// Used to pre-fill the import wizard so common bank exports map themselves.
export function guessMapping(headers: string[]): ColumnMapping {
  const find = (...needles: string[]): string | null => {
    for (const h of headers) {
      const lower = h.toLowerCase()
      if (needles.some((n) => lower.includes(n))) return h
    }
    return null
  }

  const debit = find('debit', 'withdrawal', 'money out', 'paid out')
  const credit = find('credit', 'deposit', 'money in', 'paid in')
  const amount = find('amount', 'value', 'total')

  const hasDebitCredit = !!(debit && credit)

  return {
    amountMode: hasDebitCredit ? 'debitcredit' : 'single',
    date: find('date', 'posted', 'transaction date'),
    description: find('description', 'name', 'memo', 'details', 'payee', 'narrative'),
    amount: hasDebitCredit ? null : amount,
    debit: hasDebitCredit ? debit : null,
    credit: hasDebitCredit ? credit : null,
    category: find('category', 'type'),
    section: find('section', 'account'),
    positiveMeans: 'in',
  }
}
