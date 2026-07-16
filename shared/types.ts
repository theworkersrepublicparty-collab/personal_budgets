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
  source: string | null // your account label, e.g. "Chase Card" (you set this)
  source_file: string | null // auto-captured import filename (not user-set)
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

// --- Food Recipes -----------------------------------------------------
// Stored in budget.db (like everything else in this app) so recipes carry
// over the same way to another machine or a future iPhone/Android build:
// SQLite is native on both. Photos are stored as blobs in the same file —
// one file is still everything you own. A separate git-tracked seed
// (recipe-seed.ts) ships a starter set that's inserted on first run.
export type RecipeCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Recipe {
  id: number
  title: string
  category: RecipeCategory
  cook_time: number // minutes
  protein: number // grams
  carbs: number // grams
  fats: number // grams
  calories: number
  instructions: string
  description: string
  has_image: boolean // fetch the photo separately at /api/recipes/:id/image
  created_at: string
}

// --- Workouts ------------------------------------------------------------
// Ported from the standalone workout-draft. The whole thing is pure JSON (no
// blobs), a deeply-nested editable tree, so it's persisted as ONE JSON
// document row in budget.db (table `workout_state`) behind GET/PUT /api/workout.
// That keeps it in SQLite — carrying over to another machine or a future
// iPhone/Android build exactly like the rest of the app's data. A git-tracked
// seed (workout-seed.ts) materializes the starter document on first run.
//
// A workout's stable identity is its `id`; a `workoutKey` is the composite
// "${categoryId}::${programId}::${workoutId}" the calendar assignments and log
// snapshots reference, so it's re-keyed when a workout moves between programs.

// One column in a worksheet: a rep target and the weight used.
export interface WorkoutCell {
  reps: string
  weight: string
}

export interface WorkoutExercise {
  name: string
  cells: WorkoutCell[]
  // Labels for a cell's two fields, e.g. ['R', 'W'] for reps/weight or
  // ['Time', 'Distance'] for cardio. Defaults to ['R', 'W'] when unset — the
  // underlying cell still stores { reps, weight }, this only relabels what
  // those two slots mean for this specific exercise row, independent of
  // every other row in the same workout.
  cellLabels?: [string, string]
}

// A set group (e.g. "Super Set") holding one or more exercises.
export interface WorkoutGroup {
  type: string
  exercises: WorkoutExercise[]
}

export interface Workout {
  id: string
  name: string
  equipment: string[]
  weightSuggestions: string
  notes: string
  weeks: string[] // worksheet column headers (set columns, e.g. "Set 1 (15 reps)")
  groups: WorkoutGroup[]
}

export interface WorkoutProgram {
  id: string
  name: string
  workouts: Workout[]
}

export interface WorkoutCategory {
  id: string
  name: string
  programs: WorkoutProgram[]
}

export interface WorkoutStats {
  weight: number | null // lbs
  goal: number | null // lbs
  height: number | null // TOTAL inches (feet+inches combined)
}

// A dated snapshot of a workout's reps/weight as actually performed, so later
// visits can compare "what we did" against the live, editable plan.
export interface WorkoutLog {
  id: string
  date: string // 'YYYY-MM-DD'
  workoutKey: string
  categoryName: string
  programName: string
  workoutName: string
  weeks: string[]
  groups: WorkoutGroup[]
}

export interface WorkoutDoc {
  stats: WorkoutStats
  categories: WorkoutCategory[]
  activeCategory: string
  assignments: Record<string, string[]> // dateStr 'YYYY-MM-DD' -> workoutKey[]
  logs: WorkoutLog[]
}
