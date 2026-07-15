import { createHash } from 'node:crypto'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { db, migrate } from './db.ts'
import { parseFile } from './parse.ts'
import { normalizeRow, guessMapping } from './ingest.ts'
import { matchCategory } from './rules.ts'
import { seedIfEmpty } from './seed.ts'
import { seedRecipesIfEmpty } from './recipe-seed.ts'
import { seedWorkoutIfEmpty } from './workout-seed.ts'
import { buildBackup, restoreBackup, parseGroups } from './backup.ts'
import type {
  Budget,
  BudgetConfig,
  BudgetType,
  ColumnMapping,
  EntryKind,
  Kpis,
  Lease,
  PlannerItem,
  PlannerKind,
  Property,
  PropertyConfig,
  PropertyEntry,
  Recipe,
  RecipeCategory,
  Transaction,
  TxnFilters,
  WorkoutDoc,
} from '../shared/types.ts'

migrate()
seedIfEmpty()
seedRecipesIfEmpty()
seedWorkoutIfEmpty()

const app = express()
app.use(cors())
app.use(express.json())
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

const PORT = 3001

// --- helpers --------------------------------------------------------------
interface BudgetRow {
  id: number
  name: string
  type: string
  config: string
  created_at: string
}

function rowToBudget(r: BudgetRow): Budget {
  let config: BudgetConfig = { currency: 'USD' }
  try {
    config = { currency: 'USD', ...JSON.parse(r.config || '{}') }
  } catch {
    /* keep default */
  }
  return { id: r.id, name: r.name, type: r.type as BudgetType, config, created_at: r.created_at }
}

function getBudget(id: number): Budget | null {
  const row = db.prepare('SELECT * FROM budgets WHERE id = ?').get(id) as BudgetRow | undefined
  return row ? rowToBudget(row) : null
}

// Build a WHERE clause + params from filters (used by transactions + kpis).
function buildWhere(budgetId: number, f: TxnFilters): { sql: string; params: (string | number)[] } {
  const clauses = ['budget_id = ?']
  const params: (string | number)[] = [budgetId]
  if (f.from) {
    clauses.push('txn_date >= ?')
    params.push(f.from)
  }
  if (f.to) {
    clauses.push('txn_date <= ?')
    params.push(f.to)
  }
  if (f.search) {
    clauses.push('LOWER(description) LIKE ?')
    params.push(`%${f.search.toLowerCase()}%`)
  }
  if (f.category) {
    clauses.push('category = ?')
    params.push(f.category)
  }
  if (f.section) {
    clauses.push('section = ?')
    params.push(f.section)
  }
  if (f.direction) {
    clauses.push('direction = ?')
    params.push(f.direction)
  }
  return { sql: clauses.join(' AND '), params }
}

function filtersFromQuery(q: Record<string, unknown>): TxnFilters {
  return {
    from: q.from ? String(q.from) : undefined,
    to: q.to ? String(q.to) : undefined,
    search: q.search ? String(q.search) : undefined,
    category: q.category ? String(q.category) : undefined,
    section: q.section ? String(q.section) : undefined,
    direction: q.direction === 'in' || q.direction === 'out' ? q.direction : undefined,
  }
}

function computeKpis(txns: Transaction[]): Kpis {
  let moneyIn = 0
  let moneyOut = 0
  let credits = 0
  let debits = 0
  const months = new Map<string, { in: number; out: number }>()
  const cats = new Map<string, number>()
  const sections = new Map<string, { in: number; out: number }>()
  const monthCats = new Map<string, Map<string, number>>() // month -> (category -> spend)

  for (const t of txns) {
    if (t.amount >= 0) {
      moneyIn += t.amount
      credits++
    } else {
      moneyOut += -t.amount
      debits++
    }
    const month = (t.txn_date || '').slice(0, 7) || 'unknown'
    const mEntry = months.get(month) ?? { in: 0, out: 0 }
    if (t.amount >= 0) mEntry.in += t.amount
    else mEntry.out += -t.amount
    months.set(month, mEntry)

    if (t.amount < 0) {
      const c = t.category || 'Uncategorized'
      cats.set(c, (cats.get(c) ?? 0) + -t.amount)
      const mc = monthCats.get(month) ?? new Map<string, number>()
      mc.set(c, (mc.get(c) ?? 0) + -t.amount)
      monthCats.set(month, mc)
    }

    const sec = t.section || 'General'
    const sEntry = sections.get(sec) ?? { in: 0, out: 0 }
    if (t.amount >= 0) sEntry.in += t.amount
    else sEntry.out += -t.amount
    sections.set(sec, sEntry)
  }

  const round = (n: number) => Math.round(n * 100) / 100

  return {
    moneyIn: round(moneyIn),
    moneyOut: round(moneyOut),
    net: round(moneyIn - moneyOut),
    count: txns.length,
    credits,
    debits,
    byMonth: [...months.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, in: round(v.in), out: round(v.out), net: round(v.in - v.out) })),
    byCategory: [...cats.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({ category, amount: round(amount) })),
    bySection: [...sections.entries()]
      .sort((a, b) => b[1].out - a[1].out)
      .map(([section, v]) => ({ section, in: round(v.in), out: round(v.out), net: round(v.in - v.out) })),
    byMonthCategory: [...months.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({
        month,
        total: round(v.out),
        income: round(v.in),
        cats: Object.fromEntries(
          [...(monthCats.get(month) ?? new Map<string, number>())].map(([c, a]) => [c, round(a)]),
        ),
      })),
  }
}

// --- routes ---------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.get('/api/budgets', (_req, res) => {
  const rows = db.prepare('SELECT * FROM budgets ORDER BY id').all() as unknown as BudgetRow[]
  res.json(rows.map(rowToBudget))
})

app.post('/api/budgets', (req, res) => {
  const { name, type } = req.body as { name?: string; type?: BudgetType }
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' })
  const config: BudgetConfig = { currency: 'USD' }
  const info = db
    .prepare('INSERT INTO budgets (name, type, config) VALUES (?, ?, ?)')
    .run(name.trim(), type ?? 'custom', JSON.stringify(config))
  res.json(getBudget(Number(info.lastInsertRowid)))
})

app.get('/api/budgets/:id', (req, res) => {
  const b = getBudget(Number(req.params.id))
  if (!b) return res.status(404).json({ error: 'not found' })
  res.json(b)
})

app.patch('/api/budgets/:id', (req, res) => {
  const b = getBudget(Number(req.params.id))
  if (!b) return res.status(404).json({ error: 'not found' })
  const { name, config } = req.body as { name?: string; config?: Partial<BudgetConfig> }
  const newName = name?.trim() || b.name
  const newConfig = { ...b.config, ...config }
  db.prepare('UPDATE budgets SET name = ?, config = ? WHERE id = ?').run(
    newName,
    JSON.stringify(newConfig),
    b.id,
  )
  res.json(getBudget(b.id))
})

app.delete('/api/budgets/:id', (req, res) => {
  db.prepare('DELETE FROM budgets WHERE id = ?').run(Number(req.params.id))
  res.json({ ok: true })
})

// Parse an uploaded file -> headers + preview rows + a suggested mapping.
app.post('/api/parse', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' })
  const { headers, rows } = parseFile(req.file.originalname, req.file.buffer)
  res.json({
    headers,
    rows: rows.slice(0, 20),
    rowCount: rows.length,
    suggestedMapping: guessMapping(headers),
  })
})

// Import: re-parse the file, apply the mapping, insert (skipping duplicates),
// and remember the mapping on the budget for next time.
app.post('/api/budgets/:id/import', upload.single('file'), (req, res) => {
  const b = getBudget(Number(req.params.id))
  if (!b) return res.status(404).json({ error: 'budget not found' })
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' })

  let mapping: ColumnMapping
  try {
    mapping = JSON.parse(String(req.body.mapping))
  } catch {
    return res.status(400).json({ error: 'invalid mapping' })
  }

  // One account label for the whole file (e.g. "Chase Card"), applied to every
  // row imported. Optional — blank leaves the rows' source empty.
  const source = (req.body.source ? String(req.body.source).trim() : '') || null

  const { rows } = parseFile(req.file.originalname, req.file.buffer)
  const insert = db.prepare(`
    INSERT OR IGNORE INTO transactions
      (budget_id, txn_date, description, amount, direction, category, section, source, source_file, raw_row, dedupe_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const rules = b.config.rules ?? {}
  let inserted = 0
  let considered = 0
  for (const row of rows) {
    const n = normalizeRow(row, mapping)
    if (!n) continue
    considered++
    // If the file didn't supply a category, apply YOUR saved rules so next
    // month's import from the same bank self-tags using rules you wrote.
    const category = n.category ?? matchCategory(n.description, rules)
    const info = insert.run(
      b.id,
      n.txn_date,
      n.description,
      n.amount,
      n.direction,
      category,
      n.section,
      source,
      req.file.originalname,
      n.raw_row,
      n.dedupe_hash,
    )
    if (info.changes > 0) inserted++
  }

  // Remember this mapping so the next import of the same format is one click.
  db.prepare('UPDATE budgets SET config = ? WHERE id = ?').run(
    JSON.stringify({ ...b.config, mapping }),
    b.id,
  )

  res.json({ inserted, skipped: considered - inserted, total: considered })
})

app.get('/api/budgets/:id/transactions', (req, res) => {
  const id = Number(req.params.id)
  const { sql, params } = buildWhere(id, filtersFromQuery(req.query as Record<string, unknown>))
  const rows = db
    .prepare(`SELECT * FROM transactions WHERE ${sql} ORDER BY txn_date DESC, id DESC`)
    .all(...params) as unknown as Transaction[]
  res.json(rows)
})

app.delete('/api/budgets/:id/transactions', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE budget_id = ?').run(Number(req.params.id))
  res.json({ ok: true })
})

// Earliest / latest transaction dates (ignores filters) — powers the "latest
// transaction" hint next to the filters so you know where to start a date range.
app.get('/api/budgets/:id/date-range', (req, res) => {
  const row = db
    .prepare(
      'SELECT MIN(txn_date) AS min, MAX(txn_date) AS max, COUNT(*) AS count FROM transactions WHERE budget_id = ?',
    )
    .get(Number(req.params.id)) as { min: string | null; max: string | null; count: number }
  res.json(row)
})

// Create a single transaction by hand. `amount` is signed: + = money in,
// - = money out. We give manual rows a unique dedupe_hash so two identical
// hand-entries never silently collapse into one.
app.post('/api/budgets/:id/transactions', (req, res) => {
  const b = getBudget(Number(req.params.id))
  if (!b) return res.status(404).json({ error: 'budget not found' })
  const { txn_date, description, amount, category, section, source } = req.body as {
    txn_date?: string
    description?: string
    amount?: number
    category?: string | null
    section?: string | null
    source?: string | null
  }
  const amt = Number(amount)
  if (!txn_date || Number.isNaN(amt)) {
    return res.status(400).json({ error: 'a date and a numeric amount are required' })
  }
  const direction: 'in' | 'out' = amt >= 0 ? 'in' : 'out'
  const dedupe_hash = createHash('sha1')
    .update(`manual|${Date.now()}|${Math.random()}|${txn_date}|${amt}|${description ?? ''}`)
    .digest('hex')
  const info = db
    .prepare(
      `INSERT INTO transactions
        (budget_id, txn_date, description, amount, direction, category, section, source, source_file, raw_row, dedupe_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      b.id,
      txn_date,
      (description ?? '').trim(),
      amt,
      direction,
      category || null,
      section || null,
      source || null,
      'manual entry',
      '',
      dedupe_hash,
    )
  res.json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(Number(info.lastInsertRowid)))
})

// Edit one transaction. Any omitted field is left unchanged. Used both for the
// inline category dropdown and the full edit form.
app.patch('/api/budgets/:id/transactions/:txnId', (req, res) => {
  const budgetId = Number(req.params.id)
  const txnId = Number(req.params.txnId)
  const existing = db
    .prepare('SELECT * FROM transactions WHERE id = ? AND budget_id = ?')
    .get(txnId, budgetId) as Transaction | undefined
  if (!existing) return res.status(404).json({ error: 'transaction not found' })

  const body = req.body as Partial<{
    txn_date: string
    description: string
    amount: number
    category: string | null
    section: string | null
    source: string | null
  }>
  const txn_date = body.txn_date ?? existing.txn_date
  const description = body.description ?? existing.description
  const amount =
    body.amount != null && !Number.isNaN(Number(body.amount)) ? Number(body.amount) : existing.amount
  const direction: 'in' | 'out' = amount >= 0 ? 'in' : 'out'
  const category = body.category !== undefined ? body.category || null : existing.category
  const section = body.section !== undefined ? body.section || null : existing.section
  const source = body.source !== undefined ? body.source || null : existing.source

  db.prepare(
    `UPDATE transactions
       SET txn_date = ?, description = ?, amount = ?, direction = ?, category = ?, section = ?, source = ?
     WHERE id = ?`,
  ).run(txn_date, description, amount, direction, category, section, source, txnId)
  res.json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(txnId))
})

app.delete('/api/budgets/:id/transactions/:txnId', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ? AND budget_id = ?').run(
    Number(req.params.txnId),
    Number(req.params.id),
  )
  res.json({ ok: true })
})

// Set the same category on many transactions at once (bulk tagging). Used by
// the "select rows -> apply category" toolbar in the table.
app.post('/api/budgets/:id/transactions/bulk-category', (req, res) => {
  const budgetId = Number(req.params.id)
  const { ids, category } = req.body as { ids?: number[]; category?: string | null }
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' })
  }
  const cat = category || null
  const stmt = db.prepare(
    'UPDATE transactions SET category = ? WHERE id = ? AND budget_id = ?',
  )
  let updated = 0
  for (const id of ids) updated += Number(stmt.run(cat, Number(id), budgetId).changes)
  res.json({ updated })
})

// Delete many transactions at once (bulk delete of selected rows).
app.post('/api/budgets/:id/transactions/bulk-delete', (req, res) => {
  const budgetId = Number(req.params.id)
  const { ids } = req.body as { ids?: number[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' })
  }
  const stmt = db.prepare('DELETE FROM transactions WHERE id = ? AND budget_id = ?')
  let deleted = 0
  for (const id of ids) deleted += Number(stmt.run(Number(id), budgetId).changes)
  res.json({ deleted })
})

// Apply YOUR saved rules (config.rules) to transactions. Only fills BLANK
// categories by default so your manual tags always win; pass { overwrite: true }
// to re-tag everything. Nothing is learned or guessed — it only uses your rules.
app.post('/api/budgets/:id/autocategorize', (req, res) => {
  const b = getBudget(Number(req.params.id))
  if (!b) return res.status(404).json({ error: 'budget not found' })
  const overwrite = !!(req.body && req.body.overwrite)
  const rules = b.config.rules ?? {}

  const all = db
    .prepare('SELECT * FROM transactions WHERE budget_id = ?')
    .all(b.id) as unknown as Transaction[]

  const update = db.prepare('UPDATE transactions SET category = ? WHERE id = ?')
  let updated = 0
  for (const t of all) {
    if (t.category && !overwrite) continue
    const cat = matchCategory(t.description, rules)
    if (cat && cat !== t.category) {
      update.run(cat, t.id)
      updated++
    }
  }

  res.json({ updated, ruleCount: Object.keys(rules).length })
})

app.get('/api/budgets/:id/kpis', (req, res) => {
  const id = Number(req.params.id)
  const { sql, params } = buildWhere(id, filtersFromQuery(req.query as Record<string, unknown>))
  const rows = db
    .prepare(`SELECT * FROM transactions WHERE ${sql}`)
    .all(...params) as unknown as Transaction[]
  res.json(computeKpis(rows))
})

// --- Budget Planner -------------------------------------------------------
app.get('/api/planner', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM planner_items ORDER BY kind, sort_order, id')
    .all() as unknown as PlannerItem[]
  res.json(rows)
})

app.post('/api/planner', (req, res) => {
  const { kind, name, monthly, note } = req.body as {
    kind?: PlannerKind
    name?: string
    monthly?: number
    note?: string | null
  }
  if (kind !== 'fixed' && kind !== 'variable' && kind !== 'income') {
    return res.status(400).json({ error: 'kind must be fixed, variable, or income' })
  }
  const max = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM planner_items WHERE kind = ?')
    .get(kind) as { m: number }
  const info = db
    .prepare('INSERT INTO planner_items (kind, name, monthly, note, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(kind, (name ?? '').trim(), Number(monthly) || 0, note ?? null, Number(max.m) + 1)
  res.json(db.prepare('SELECT * FROM planner_items WHERE id = ?').get(Number(info.lastInsertRowid)))
})

app.patch('/api/planner/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM planner_items WHERE id = ?').get(id) as
    | PlannerItem
    | undefined
  if (!existing) return res.status(404).json({ error: 'not found' })
  const body = req.body as Partial<{ name: string; monthly: number; note: string | null }>
  const name = body.name !== undefined ? body.name : existing.name
  const monthly =
    body.monthly != null && !Number.isNaN(Number(body.monthly)) ? Number(body.monthly) : existing.monthly
  const note = body.note !== undefined ? body.note : existing.note
  db.prepare('UPDATE planner_items SET name = ?, monthly = ?, note = ? WHERE id = ?').run(
    name,
    monthly,
    note,
    id,
  )
  res.json(db.prepare('SELECT * FROM planner_items WHERE id = ?').get(id))
})

app.delete('/api/planner/:id', (req, res) => {
  db.prepare('DELETE FROM planner_items WHERE id = ?').run(Number(req.params.id))
  res.json({ ok: true })
})

// --- Rental properties ----------------------------------------------------
interface PropertyRow {
  id: number
  name: string
  address: string
  config: string
  created_at: string
}

function rowToProperty(r: PropertyRow): Property {
  let config: PropertyConfig = {}
  try {
    config = JSON.parse(r.config || '{}')
  } catch {
    /* keep default */
  }
  return { id: r.id, name: r.name, address: r.address, config, created_at: r.created_at }
}

function getProperty(id: number): Property | null {
  const row = db.prepare('SELECT * FROM properties WHERE id = ?').get(id) as PropertyRow | undefined
  return row ? rowToProperty(row) : null
}

app.get('/api/properties', (_req, res) => {
  const rows = db.prepare('SELECT * FROM properties ORDER BY id').all() as unknown as PropertyRow[]
  res.json(rows.map(rowToProperty))
})

app.post('/api/properties', (req, res) => {
  const { name, address, config } = req.body as {
    name?: string
    address?: string
    config?: PropertyConfig
  }
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' })
  const info = db
    .prepare('INSERT INTO properties (name, address, config) VALUES (?, ?, ?)')
    .run(name.trim(), (address ?? '').trim(), JSON.stringify(config ?? {}))
  res.json(getProperty(Number(info.lastInsertRowid)))
})

app.get('/api/properties/:id', (req, res) => {
  const p = getProperty(Number(req.params.id))
  if (!p) return res.status(404).json({ error: 'not found' })
  res.json(p)
})

app.patch('/api/properties/:id', (req, res) => {
  const p = getProperty(Number(req.params.id))
  if (!p) return res.status(404).json({ error: 'not found' })
  const { name, address, config } = req.body as {
    name?: string
    address?: string
    config?: Partial<PropertyConfig>
  }
  db.prepare('UPDATE properties SET name = ?, address = ?, config = ? WHERE id = ?').run(
    name?.trim() || p.name,
    address !== undefined ? address.trim() : p.address,
    JSON.stringify({ ...p.config, ...config }),
    p.id,
  )
  res.json(getProperty(p.id))
})

app.delete('/api/properties/:id', (req, res) => {
  db.prepare('DELETE FROM properties WHERE id = ?').run(Number(req.params.id))
  res.json({ ok: true })
})

app.get('/api/properties/:id/entries', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM property_entries WHERE property_id = ? ORDER BY entry_date DESC, id DESC')
    .all(Number(req.params.id)) as unknown as PropertyEntry[]
  res.json(rows)
})

app.post('/api/properties/:id/entries', (req, res) => {
  const propertyId = Number(req.params.id)
  if (!getProperty(propertyId)) return res.status(404).json({ error: 'property not found' })
  const { entry_date, kind, category, amount, note } = req.body as {
    entry_date?: string
    kind?: EntryKind
    category?: string
    amount?: number
    note?: string | null
  }
  if (!entry_date || (kind !== 'income' && kind !== 'expense')) {
    return res.status(400).json({ error: 'entry_date and kind (income|expense) are required' })
  }
  const info = db
    .prepare(
      'INSERT INTO property_entries (property_id, entry_date, kind, category, amount, note) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(propertyId, entry_date, kind, (category ?? '').trim(), Math.abs(Number(amount) || 0), note ?? null)
  res.json(db.prepare('SELECT * FROM property_entries WHERE id = ?').get(Number(info.lastInsertRowid)))
})

app.patch('/api/properties/:id/entries/:eid', (req, res) => {
  const eid = Number(req.params.eid)
  const existing = db.prepare('SELECT * FROM property_entries WHERE id = ?').get(eid) as
    | PropertyEntry
    | undefined
  if (!existing) return res.status(404).json({ error: 'not found' })
  const b = req.body as Partial<{
    entry_date: string
    kind: EntryKind
    category: string
    amount: number
    note: string | null
    paid: number
  }>
  db.prepare(
    'UPDATE property_entries SET entry_date = ?, kind = ?, category = ?, amount = ?, note = ?, paid = ? WHERE id = ?',
  ).run(
    b.entry_date ?? existing.entry_date,
    b.kind ?? existing.kind,
    b.category !== undefined ? b.category : existing.category,
    b.amount != null && !Number.isNaN(Number(b.amount)) ? Math.abs(Number(b.amount)) : existing.amount,
    b.note !== undefined ? b.note : existing.note,
    b.paid != null ? (b.paid ? 1 : 0) : existing.paid,
    eid,
  )
  res.json(db.prepare('SELECT * FROM property_entries WHERE id = ?').get(eid))
})

app.delete('/api/properties/:id/entries/:eid', (req, res) => {
  db.prepare('DELETE FROM property_entries WHERE id = ? AND property_id = ?').run(
    Number(req.params.eid),
    Number(req.params.id),
  )
  res.json({ ok: true })
})

app.post('/api/properties/:id/entries/bulk-delete', (req, res) => {
  const { ids } = req.body as { ids?: number[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' })
  }
  const stmt = db.prepare('DELETE FROM property_entries WHERE id = ? AND property_id = ?')
  let deleted = 0
  for (const id of ids) deleted += Number(stmt.run(Number(id), Number(req.params.id)).changes)
  res.json({ deleted })
})

// Shared master list of property categories — feeds every property's dropdowns.
const DEFAULT_PROPERTY_CATEGORIES = [
  'Rent', 'Late fee', 'Pet rent', 'Other income',
  'Mortgage', 'Property taxes', 'Insurance', 'Repairs', 'Maintenance', 'Management',
  'Utilities', 'HOA', 'Vacancy / lost rent', 'CapEx', 'Supplies', 'Legal / professional',
  'Security deposit', 'Other',
]

app.get('/api/property-categories', (_req, res) => {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('propertyCategories') as
    | { value: string }
    | undefined
  let cats: string[] = DEFAULT_PROPERTY_CATEGORIES
  if (row) {
    try {
      const parsed = JSON.parse(row.value)
      if (Array.isArray(parsed)) cats = parsed
    } catch {
      /* keep default */
    }
  }
  res.json(cats)
})

app.put('/api/property-categories', (req, res) => {
  const { categories } = req.body as { categories?: string[] }
  const list = Array.isArray(categories)
    ? [...new Set(categories.map((c) => String(c).trim()).filter(Boolean))]
    : []
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES ('propertyCategories', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(JSON.stringify(list))
  res.json(list)
})

// --- Leases (recurring rent) ---
// Inclusive list of 'YYYY-MM' months from start to end.
function monthRange(start: string, end: string): string[] {
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  if (!sy || !sm || !ey || !em) return []
  const out: string[] = []
  let y = sy
  let m = sm
  // cap at 600 months (50 yrs) as a runaway guard
  for (let i = 0; i < 600 && (y < ey || (y === ey && m <= em)); i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

app.get('/api/properties/:id/leases', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM leases WHERE property_id = ? ORDER BY start_month DESC, id DESC')
    .all(Number(req.params.id)) as unknown as Lease[]
  res.json(rows)
})

// Create a lease and generate one unpaid rent row per month in its range.
app.post('/api/properties/:id/leases', (req, res) => {
  const propertyId = Number(req.params.id)
  if (!getProperty(propertyId)) return res.status(404).json({ error: 'property not found' })
  const { tenant, start_month, end_month, monthly_rent, note, deposit, prepaid } = req.body as {
    tenant?: string
    start_month?: string
    end_month?: string
    monthly_rent?: number
    note?: string | null
    deposit?: number // security deposit collected at move-in
    prepaid?: number // first/last month's rent or other upfront money
  }
  const months = monthRange(start_month ?? '', end_month ?? '')
  if (months.length === 0) {
    return res.status(400).json({ error: 'valid start_month and end_month (YYYY-MM) are required' })
  }
  const rent = Math.abs(Number(monthly_rent) || 0)
  const info = db
    .prepare(
      'INSERT INTO leases (property_id, tenant, start_month, end_month, monthly_rent, note) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(propertyId, (tenant ?? '').trim(), months[0], months[months.length - 1], rent, note ?? null)
  const leaseId = Number(info.lastInsertRowid)

  const insert = db.prepare(
    `INSERT INTO property_entries (property_id, entry_date, kind, category, amount, note, paid, lease_id)
     VALUES (?, ?, 'income', ?, ?, ?, 0, ?)`,
  )
  for (const m of months) insert.run(propertyId, `${m}-01`, 'Rent', rent, tenant ? `Rent — ${tenant}` : null, leaseId)

  // One-time move-in money, dated at the start month, also unpaid until collected.
  let generated = months.length
  const dep = Math.abs(Number(deposit) || 0)
  const pre = Math.abs(Number(prepaid) || 0)
  if (dep > 0) {
    insert.run(propertyId, `${months[0]}-01`, 'Security deposit', dep, tenant ? `Deposit — ${tenant}` : 'refundable', leaseId)
    generated++
  }
  if (pre > 0) {
    insert.run(propertyId, `${months[0]}-01`, 'First / last month (upfront)', pre, null, leaseId)
    generated++
  }

  res.json({ lease: db.prepare('SELECT * FROM leases WHERE id = ?').get(leaseId), generated })
})

// Delete a lease and the rent rows it generated.
app.delete('/api/properties/:id/leases/:lid', (req, res) => {
  const lid = Number(req.params.lid)
  db.prepare('DELETE FROM property_entries WHERE lease_id = ?').run(lid)
  db.prepare('DELETE FROM leases WHERE id = ? AND property_id = ?').run(lid, Number(req.params.id))
  res.json({ ok: true })
})

// --- Food Recipes ----------------------------------------------------------
interface RecipeRow {
  id: number
  title: string
  category: string
  cook_time: number
  protein: number
  carbs: number
  fats: number
  calories: number
  instructions: string
  description: string
  image: Uint8Array | null
  image_mime: string | null
  created_at: string
}

const RECIPE_CATEGORIES: RecipeCategory[] = ['breakfast', 'lunch', 'dinner', 'snack']

function rowToRecipe(r: RecipeRow): Recipe {
  return {
    id: r.id,
    title: r.title,
    category: (RECIPE_CATEGORIES.includes(r.category as RecipeCategory) ? r.category : 'dinner') as RecipeCategory,
    cook_time: r.cook_time,
    protein: r.protein,
    carbs: r.carbs,
    fats: r.fats,
    calories: r.calories,
    instructions: r.instructions,
    description: r.description,
    has_image: !!r.image,
    created_at: r.created_at,
  }
}

const RECIPE_COLUMNS = `
  id, title, category, cook_time, protein, carbs, fats, calories,
  instructions, description, image, image_mime, created_at
`

app.get('/api/recipes', (req, res) => {
  const { category, search } = req.query as { category?: string; search?: string }
  const clauses: string[] = []
  const params: string[] = []
  if (category && RECIPE_CATEGORIES.includes(category as RecipeCategory)) {
    clauses.push('category = ?')
    params.push(category)
  }
  if (search) {
    clauses.push('LOWER(title) LIKE ?')
    params.push(`%${search.toLowerCase()}%`)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = db
    .prepare(`SELECT ${RECIPE_COLUMNS} FROM recipes ${where} ORDER BY title COLLATE NOCASE`)
    .all(...params) as unknown as RecipeRow[]
  res.json(rows.map(rowToRecipe))
})

app.get('/api/recipes/:id', (req, res) => {
  const row = db
    .prepare(`SELECT ${RECIPE_COLUMNS} FROM recipes WHERE id = ?`)
    .get(Number(req.params.id)) as RecipeRow | undefined
  if (!row) return res.status(404).json({ error: 'not found' })
  res.json(rowToRecipe(row))
})

app.get('/api/recipes/:id/image', (req, res) => {
  const row = db
    .prepare('SELECT image, image_mime FROM recipes WHERE id = ?')
    .get(Number(req.params.id)) as { image: Uint8Array | null; image_mime: string | null } | undefined
  if (!row || !row.image) return res.status(404).end()
  res.set('Content-Type', row.image_mime || 'application/octet-stream')
  // The image URL never changes (it's keyed by recipe id), so a replaced photo
  // would otherwise keep showing the browser's cached copy. `no-cache` makes the
  // browser revalidate first; Express's ETag returns 304 when it's unchanged, so
  // this stays cheap while always showing the current photo.
  res.set('Cache-Control', 'no-cache')
  res.send(Buffer.from(row.image))
})

function recipeFieldsFromBody(body: Record<string, unknown>) {
  const category = RECIPE_CATEGORIES.includes(body.category as RecipeCategory)
    ? (body.category as RecipeCategory)
    : 'dinner'
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  return {
    title: String(body.title ?? '').trim(),
    category,
    cook_time: num(body.cook_time),
    protein: num(body.protein),
    carbs: num(body.carbs),
    fats: num(body.fats),
    calories: num(body.calories),
    instructions: String(body.instructions ?? ''),
    description: String(body.description ?? ''),
  }
}

app.post('/api/recipes', upload.single('image'), (req, res) => {
  const f = recipeFieldsFromBody(req.body as Record<string, unknown>)
  if (!f.title) return res.status(400).json({ error: 'title is required' })
  const info = db
    .prepare(`
      INSERT INTO recipes
        (title, category, cook_time, protein, carbs, fats, calories, instructions, description, image, image_mime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      f.title,
      f.category,
      f.cook_time,
      f.protein,
      f.carbs,
      f.fats,
      f.calories,
      f.instructions,
      f.description,
      req.file ? req.file.buffer : null,
      req.file ? req.file.mimetype : null,
    )
  const row = db
    .prepare(`SELECT ${RECIPE_COLUMNS} FROM recipes WHERE id = ?`)
    .get(Number(info.lastInsertRowid)) as unknown as RecipeRow
  res.json(rowToRecipe(row))
})

app.patch('/api/recipes/:id', upload.single('image'), (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare(`SELECT ${RECIPE_COLUMNS} FROM recipes WHERE id = ?`).get(id) as
    | RecipeRow
    | undefined
  if (!existing) return res.status(404).json({ error: 'not found' })

  const body = req.body as Record<string, unknown>
  const f = recipeFieldsFromBody({
    title: body.title ?? existing.title,
    category: body.category ?? existing.category,
    cook_time: body.cook_time ?? existing.cook_time,
    protein: body.protein ?? existing.protein,
    carbs: body.carbs ?? existing.carbs,
    fats: body.fats ?? existing.fats,
    calories: body.calories ?? existing.calories,
    instructions: body.instructions ?? existing.instructions,
    description: body.description ?? existing.description,
  })

  // Photo has three cases: a new file replaces it, remove_image=1 clears it
  // (recipe falls back to the default category icon), or leave it unchanged.
  const removeImage = (req.body as Record<string, unknown>).remove_image === '1'
  const imageClause = req.file
    ? ', image = ?, image_mime = ?'
    : removeImage
      ? ', image = NULL, image_mime = NULL'
      : ''
  const imageArgs = req.file ? [req.file.buffer, req.file.mimetype] : []

  db.prepare(`
    UPDATE recipes SET
      title = ?, category = ?, cook_time = ?, protein = ?, carbs = ?, fats = ?, calories = ?,
      instructions = ?, description = ?${imageClause}
    WHERE id = ?
  `).run(
    f.title,
    f.category,
    f.cook_time,
    f.protein,
    f.carbs,
    f.fats,
    f.calories,
    f.instructions,
    f.description,
    ...imageArgs,
    id,
  )
  const row = db.prepare(`SELECT ${RECIPE_COLUMNS} FROM recipes WHERE id = ?`).get(id) as unknown as RecipeRow
  res.json(rowToRecipe(row))
})

app.delete('/api/recipes/:id', (req, res) => {
  db.prepare('DELETE FROM recipes WHERE id = ?').run(Number(req.params.id))
  res.json({ ok: true })
})

// Delete many recipes at once (bulk delete of selected cards, across categories).
app.post('/api/recipes/bulk-delete', (req, res) => {
  const { ids } = req.body as { ids?: number[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' })
  }
  const stmt = db.prepare('DELETE FROM recipes WHERE id = ?')
  let deleted = 0
  for (const id of ids) deleted += Number(stmt.run(Number(id)).changes)
  res.json({ deleted })
})

// Cronometer "export as CSV" (a recipe's nutrition breakdown, or a diary day)
// has per-ingredient/per-entry rows with columns like "Energy (kcal)",
// "Protein (g)", "Carbs (g)", "Fat (g)" (naming varies slightly by export).
// We sum whichever of those columns are present across all rows.
function findColumn(headers: string[],...needles: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase())
  for (const needle of needles) {
    const idx = lower.findIndex((h) => h.includes(needle))
    if (idx !== -1) return headers[idx]
  }
  return null
}

// Parse a Cronometer export and sum the macro columns across every row.
// Returns null when the file has no recognizable macro columns at all.
function cronometerMacros(originalname: string, buffer: Buffer) {
  const { headers, rows } = parseFile(originalname, buffer)
  const calCol = findColumn(headers, 'energy', 'calorie')
  const proteinCol = findColumn(headers, 'protein')
  const carbsCol = findColumn(headers, 'carb')
  const fatCol = findColumn(headers, 'fat')

  if (!calCol && !proteinCol && !carbsCol && !fatCol) return null

  const sum = (col: string | null) =>
    col ? rows.reduce((acc, r) => acc + (parseFloat(r[col]) || 0), 0) : 0

  return {
    rowsRead: rows.length,
    macros: {
      calories: Math.round(sum(calCol) * 10) / 10,
      protein: Math.round(sum(proteinCol) * 10) / 10,
      carbs: Math.round(sum(carbsCol) * 10) / 10,
      fats: Math.round(sum(fatCol) * 10) / 10,
    },
  }
}

// Create a brand-new recipe straight from a Cronometer file: caller supplies
// the title + category, macros come from the file, everything else starts blank.
app.post('/api/recipes/import-cronometer', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' })
  const body = req.body as Record<string, unknown>
  const title = String(body.title ?? '').trim()
  if (!title) return res.status(400).json({ error: 'title is required' })
  const category = RECIPE_CATEGORIES.includes(body.category as RecipeCategory)
    ? (body.category as RecipeCategory)
    : 'dinner'

  const parsed = cronometerMacros(req.file.originalname, req.file.buffer)
  if (!parsed) return res.status(400).json({ error: 'no recognizable macro columns found in this file' })
  const { macros, rowsRead } = parsed

  const info = db
    .prepare(`
      INSERT INTO recipes
        (title, category, cook_time, protein, carbs, fats, calories, instructions, description, image, image_mime)
      VALUES (?, ?, 0, ?, ?, ?, ?, '', '', NULL, NULL)
    `)
    .run(title, category, macros.protein, macros.carbs, macros.fats, macros.calories)
  const row = db
    .prepare(`SELECT ${RECIPE_COLUMNS} FROM recipes WHERE id = ?`)
    .get(Number(info.lastInsertRowid)) as unknown as RecipeRow
  res.json({ recipe: rowToRecipe(row), rowsRead, ...macros })
})

app.post('/api/recipes/:id/import-cronometer', upload.single('file'), (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT id FROM recipes WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'recipe not found' })
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' })

  const parsed = cronometerMacros(req.file.originalname, req.file.buffer)
  if (!parsed) {
    return res.status(400).json({ error: 'no recognizable macro columns found in this file' })
  }
  const { macros, rowsRead } = parsed

  db.prepare('UPDATE recipes SET protein = ?, carbs = ?, fats = ?, calories = ? WHERE id = ?').run(
    macros.protein,
    macros.carbs,
    macros.fats,
    macros.calories,
    id,
  )
  const row = db.prepare(`SELECT ${RECIPE_COLUMNS} FROM recipes WHERE id = ?`).get(id) as unknown as RecipeRow
  res.json({ recipe: rowToRecipe(row), rowsRead, ...macros })
})

// --- Workouts --------------------------------------------------------------
// The whole workout tab is one JSON document in workout_state (row id = 1),
// seeded on first run. The client fetches it, edits in memory, and PUTs the
// full document back (debounced). Keeping it a single blob mirrors how pure-JSON
// state is the most portable thing to carry to a future mobile build.
app.get('/api/workout', (_req, res) => {
  const row = db.prepare('SELECT doc FROM workout_state WHERE id = 1').get() as
    | { doc: string }
    | undefined
  if (!row) return res.status(404).json({ error: 'workout document not initialized' })
  try {
    res.json(JSON.parse(row.doc) as WorkoutDoc)
  } catch {
    res.status(500).json({ error: 'stored workout document is corrupt' })
  }
})

app.put('/api/workout', (req, res) => {
  const doc = req.body as WorkoutDoc
  // Light shape check — enough to reject obviously malformed writes without
  // trying to validate the whole nested tree.
  if (
    !doc ||
    typeof doc !== 'object' ||
    !Array.isArray(doc.categories) ||
    !Array.isArray(doc.logs) ||
    typeof doc.assignments !== 'object' ||
    doc.assignments === null
  ) {
    return res.status(400).json({ error: 'invalid workout document' })
  }
  db.prepare(
    `INSERT INTO workout_state (id, doc) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET doc = excluded.doc`,
  ).run(JSON.stringify(doc))
  res.json({ ok: true })
})

// --- Backup / Restore ------------------------------------------------------
// Download selected tabs as one .xlsx workbook (?groups=budgets,planner,...).
app.get('/api/export', (req, res) => {
  const groups = parseGroups(req.query.groups)
  const buf = buildBackup(groups)
  const stamp = new Date().toISOString().slice(0, 10)
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  res.setHeader('Content-Disposition', `attachment; filename="budgets-backup-${stamp}.xlsx"`)
  res.send(buf)
})

// Restore a backup file: REPLACES all data in whichever selected tabs are
// present in the file. Tabs not selected (or not in the file) are untouched.
app.post('/api/import-backup', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' })
  const groups = parseGroups((req.body as { groups?: string }).groups)
  try {
    const restored = restoreBackup(req.file.buffer, groups)
    res.json({ ok: true, restored })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message || 'could not read this backup file' })
  }
})

app.listen(PORT, () => {
  console.log(`\n  💰 Personal Budgets API running at http://localhost:${PORT}`)
  console.log(`     Open the app at http://localhost:5173\n`)
})
