// Types shared between the Express server and the React frontend.

export type BudgetType = 'living' | 'business' | 'custom'

// How a single canonical field is sourced from the imported file's columns.
// `amount` mode: one signed column. `debitcredit` mode: separate columns.
export interface ColumnMapping {
  amountMode: 'single' | 'debitcredit'
  date: string | null // header name for the date
  description: string | null // header name for the description
  amount: string | null // header name when amountMode === 'single'
  debit: string | null // header name when amountMode === 'debitcredit'
  credit: string | null // header name when amountMode === 'debitcredit'
  category: string | null // optional header name
  section: string | null // optional header name (business sections)
  // When amountMode === 'single', do positive numbers mean money IN or OUT?
  positiveMeans: 'in' | 'out'
  dateFormat?: string // optional hint, e.g. "MM/DD/YYYY"
}

export interface BudgetConfig {
  currency: string // e.g. "USD"
  mapping?: ColumnMapping // last-used mapping, auto-applied on next import
  categories?: string[] // your own editable category list (drives the pie + KPIs)
  rules?: Record<string, string> // YOUR manual rules: description keyword -> category
}

export interface Budget {
  id: number
  name: string
  type: BudgetType
  config: BudgetConfig
  created_at: string
}

export interface Transaction {
  id: number
  budget_id: number
  txn_date: string // ISO date (YYYY-MM-DD)
  description: string
  amount: number // signed: positive = money in, negative = money out
  direction: 'in' | 'out'
  category: string | null
  section: string | null
  source_file: string | null
  created_at: string
}

export interface ParsePreview {
  headers: string[]
  rows: Record<string, string>[] // first N rows for preview
  rowCount: number
}

export interface ImportResult {
  inserted: number
  skipped: number // duplicates
  total: number
}

export interface Kpis {
  moneyIn: number
  moneyOut: number
  net: number
  count: number
  credits: number // count of money-in transactions
  debits: number // count of money-out transactions
  byMonth: { month: string; in: number; out: number; net: number }[]
  byCategory: { category: string; amount: number }[] // spending by category (money out)
  bySection: { section: string; in: number; out: number; net: number }[]
}

export interface TxnFilters {
  from?: string
  to?: string
  search?: string
  category?: string
  section?: string
  direction?: 'in' | 'out'
}
