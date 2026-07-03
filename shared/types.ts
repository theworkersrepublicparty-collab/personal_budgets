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
  // Per-month spending broken down by category (for the stacked monthly chart).
  byMonthCategory: { month: string; total: number; income: number; cats: Record<string, number> }[]
}

// --- Budget Planner (separate yearly plan) -------------------------------
export type PlannerKind = 'fixed' | 'variable' | 'income'

export interface PlannerItem {
  id: number
  kind: PlannerKind
  name: string
  monthly: number // yearly is derived as monthly * 12
  note: string | null
  sort_order: number
}

// --- Rental properties (landlord accounting) -----------------------------
export interface FixedCost {
  category: string
  amount: number // recurring monthly amount
}

export interface PropertyConfig {
  purchasePrice?: number
  closingCosts?: number
  rehab?: number
  downPayment?: number // dollars actually put down
  loanAmount?: number
  rate?: number // annual interest %
  termYears?: number
  paidOff?: boolean // owned free & clear — no mortgage
  fixedCosts?: FixedCost[] // recurring monthly expenses, auto-included every month
}

export interface Property {
  id: number
  name: string
  address: string
  config: PropertyConfig
  created_at: string
}

export type EntryKind = 'income' | 'expense'

export interface PropertyEntry {
  id: number
  property_id: number
  entry_date: string // ISO YYYY-MM-DD
  kind: EntryKind
  category: string
  amount: number // positive; kind gives the sign
  note: string | null
  paid: number // 1 = realized/counted, 0 = scheduled-but-unpaid (lease rent)
  lease_id: number | null // set when this row was generated from a lease
}

export interface Lease {
  id: number
  property_id: number
  tenant: string
  start_month: string // 'YYYY-MM'
  end_month: string // 'YYYY-MM'
  monthly_rent: number
  note: string | null
  created_at: string
}

export interface TxnFilters {
  from?: string
  to?: string
  search?: string
  category?: string
  section?: string
  direction?: 'in' | 'out'
}
