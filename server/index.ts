import { createHash } from 'node:crypto'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { db, migrate } from './db.ts'
import { parseFile } from './parse.ts'
import { normalizeRow, guessMapping } from './ingest.ts'
import { matchCategory } from './rules.ts'
import { seedIfEmpty } from './seed.ts'
import type {
  Budget,
  BudgetConfig,
  BudgetType,
  ColumnMapping,
  Kpis,
  Transaction,
  TxnFilters,
} from '../shared/types.ts'

migrate()
seedIfEmpty()

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

  const { rows } = parseFile(req.file.originalname, req.file.buffer)
  const insert = db.prepare(`
    INSERT OR IGNORE INTO transactions
      (budget_id, txn_date, description, amount, direction, category, section, source_file, raw_row, dedupe_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

// Create a single transaction by hand. `amount` is signed: + = money in,
// - = money out. We give manual rows a unique dedupe_hash so two identical
// hand-entries never silently collapse into one.
app.post('/api/budgets/:id/transactions', (req, res) => {
  const b = getBudget(Number(req.params.id))
  if (!b) return res.status(404).json({ error: 'budget not found' })
  const { txn_date, description, amount, category, section } = req.body as {
    txn_date?: string
    description?: string
    amount?: number
    category?: string | null
    section?: string | null
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
        (budget_id, txn_date, description, amount, direction, category, section, source_file, raw_row, dedupe_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      b.id,
      txn_date,
      (description ?? '').trim(),
      amt,
      direction,
      category || null,
      section || null,
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
  }>
  const txn_date = body.txn_date ?? existing.txn_date
  const description = body.description ?? existing.description
  const amount =
    body.amount != null && !Number.isNaN(Number(body.amount)) ? Number(body.amount) : existing.amount
  const direction: 'in' | 'out' = amount >= 0 ? 'in' : 'out'
  const category = body.category !== undefined ? body.category || null : existing.category
  const section = body.section !== undefined ? body.section || null : existing.section

  db.prepare(
    `UPDATE transactions
       SET txn_date = ?, description = ?, amount = ?, direction = ?, category = ?, section = ?
     WHERE id = ?`,
  ).run(txn_date, description, amount, direction, category, section, txnId)
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

app.listen(PORT, () => {
  console.log(`\n  💰 Personal Budgets API running at http://localhost:${PORT}`)
  console.log(`     Open the app at http://localhost:5173\n`)
})
