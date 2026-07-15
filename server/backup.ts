// Backup / restore of user data as a single .xlsx workbook.
//
// Each selectable "tab" the user sees in the app maps to a GROUP here, and each
// group owns one or more sheets in the workbook. Download writes the chosen
// groups' sheets; restore REPLACES every table in the chosen groups with the
// rows found in the file (per-tab replace — tabs not in the file are left
// alone). Recipe photos (BLOBs) are intentionally excluded: a spreadsheet can't
// hold them, and budget.db itself remains the photos-included full backup.
import { createHash } from 'node:crypto'
import * as XLSX from 'xlsx'
import { db } from './db.ts'

export type BackupGroup = 'budgets' | 'planner' | 'properties' | 'recipes' | 'workouts'

export const ALL_GROUPS: BackupGroup[] = ['budgets', 'planner', 'properties', 'recipes', 'workouts']

// Which sheet names make up each group. The first sheet is the group's "marker"
// used to detect the group's presence in an uploaded file.
const GROUP_SHEETS: Record<BackupGroup, string[]> = {
  budgets: ['Budgets', 'Transactions'],
  planner: ['Planner'],
  properties: ['Properties', 'PropertyEntries', 'Leases', 'PropertyCategories'],
  recipes: ['Recipes'],
  workouts: ['Workout'],
}

// Column order per sheet — keeps exports tidy and gives empty tables a header row.
const COLS = {
  Budgets: ['id', 'name', 'type', 'config', 'created_at'],
  Transactions: [
    'id', 'budget_id', 'txn_date', 'description', 'amount', 'direction',
    'category', 'section', 'source', 'source_file', 'created_at',
  ],
  Planner: ['id', 'kind', 'name', 'monthly', 'note', 'sort_order'],
  Properties: ['id', 'name', 'address', 'config', 'created_at'],
  PropertyEntries: [
    'id', 'property_id', 'entry_date', 'kind', 'category', 'amount', 'note', 'paid', 'lease_id',
  ],
  Leases: [
    'id', 'property_id', 'tenant', 'start_month', 'end_month', 'monthly_rent', 'note', 'created_at',
  ],
  PropertyCategories: ['category'],
  Recipes: [
    'id', 'title', 'category', 'cook_time', 'protein', 'carbs', 'fats', 'calories',
    'instructions', 'description', 'created_at',
  ],
  // The whole workout tab is one JSON document, so it rides in a single cell.
  Workout: ['doc'],
} as const

export function parseGroups(raw: unknown): BackupGroup[] {
  const list = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === 'string' && raw.trim()
      ? raw.split(',').map((s) => s.trim())
      : []
  const picked = list.filter((g): g is BackupGroup => (ALL_GROUPS as string[]).includes(g))
  return picked.length ? picked : ALL_GROUPS
}

// --- Export ---------------------------------------------------------------
function sheetFrom(cols: readonly string[], rows: Record<string, unknown>[]): XLSX.WorkSheet {
  if (rows.length === 0) return XLSX.utils.aoa_to_sheet([cols as string[]])
  return XLSX.utils.json_to_sheet(rows, { header: cols as string[] })
}

export function buildBackup(groups: BackupGroup[]): Buffer {
  const wb = XLSX.utils.book_new()
  const add = (name: keyof typeof COLS, rows: Record<string, unknown>[]) =>
    XLSX.utils.book_append_sheet(wb, sheetFrom(COLS[name], rows), name)
  const all = (sql: string) => db.prepare(sql).all() as Record<string, unknown>[]

  if (groups.includes('budgets')) {
    add('Budgets', all('SELECT id, name, type, config, created_at FROM budgets ORDER BY id'))
    add(
      'Transactions',
      all(`SELECT id, budget_id, txn_date, description, amount, direction, category,
                  section, source, source_file, created_at
           FROM transactions ORDER BY id`),
    )
  }
  if (groups.includes('planner')) {
    add('Planner', all('SELECT id, kind, name, monthly, note, sort_order FROM planner_items ORDER BY id'))
  }
  if (groups.includes('properties')) {
    add('Properties', all('SELECT id, name, address, config, created_at FROM properties ORDER BY id'))
    add(
      'PropertyEntries',
      all(`SELECT id, property_id, entry_date, kind, category, amount, note, paid, lease_id
           FROM property_entries ORDER BY id`),
    )
    add(
      'Leases',
      all(`SELECT id, property_id, tenant, start_month, end_month, monthly_rent, note, created_at
           FROM leases ORDER BY id`),
    )
    const catRow = db
      .prepare("SELECT value FROM app_settings WHERE key = 'propertyCategories'")
      .get() as { value: string } | undefined
    let cats: string[] = []
    if (catRow) {
      try {
        const parsed = JSON.parse(catRow.value)
        if (Array.isArray(parsed)) cats = parsed
      } catch {
        /* ignore */
      }
    }
    add('PropertyCategories', cats.map((c) => ({ category: c })))
  }
  if (groups.includes('recipes')) {
    add(
      'Recipes',
      all(`SELECT id, title, category, cook_time, protein, carbs, fats, calories,
                  instructions, description, created_at
           FROM recipes ORDER BY id`),
    )
  }
  if (groups.includes('workouts')) {
    const row = db.prepare('SELECT doc FROM workout_state WHERE id = 1').get() as
      | { doc: string }
      | undefined
    add('Workout', row ? [{ doc: row.doc }] : [])
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

// --- Restore --------------------------------------------------------------
const str = (v: unknown): string => (v == null ? '' : String(v))
const numOrNull = (v: unknown): number | null =>
  v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v)
const num = (v: unknown): number => numOrNull(v) ?? 0
const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

// Groups actually present in an uploaded workbook (by marker sheet).
export function groupsInWorkbook(buffer: Buffer): BackupGroup[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const names = new Set(wb.SheetNames)
  return ALL_GROUPS.filter((g) => GROUP_SHEETS[g].some((s) => names.has(s)))
}

export function restoreBackup(buffer: Buffer, requested: BackupGroup[]): Record<BackupGroup, number> {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const present = new Set(groupsInWorkbook(buffer))
  const groups = requested.filter((g) => present.has(g))
  const rows = (name: string): Record<string, unknown>[] => {
    const ws = wb.Sheets[name]
    return ws ? (XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, unknown>[]) : []
  }
  const counts: Record<BackupGroup, number> = {
    budgets: 0, planner: 0, properties: 0, recipes: 0, workouts: 0,
  }

  db.exec('BEGIN')
  try {
    if (groups.includes('budgets')) {
      db.exec('DELETE FROM transactions')
      db.exec('DELETE FROM budgets')
      const insB = db.prepare(
        'INSERT INTO budgets (id, name, type, config, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      for (const b of rows('Budgets')) {
        insB.run(
          num(b.id) || null,
          str(b.name),
          str(b.type) || 'custom',
          str(b.config) || '{}',
          str(b.created_at) || nowStamp(),
        )
      }
      const insT = db.prepare(`
        INSERT INTO transactions
          (id, budget_id, txn_date, description, amount, direction, category, section,
           source, source_file, raw_row, dedupe_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      let i = 0
      for (const t of rows('Transactions')) {
        const amount = num(t.amount)
        const direction = str(t.direction) || (amount >= 0 ? 'in' : 'out')
        // Regenerate a guaranteed-unique dedupe hash per row (the restored set is
        // authoritative; we don't want two identical rows to collide on the index).
        const hash = createHash('sha1').update(`restore|${i}|${JSON.stringify(t)}`).digest('hex')
        insT.run(
          num(t.id) || null,
          num(t.budget_id),
          str(t.txn_date),
          str(t.description),
          amount,
          direction,
          t.category == null || t.category === '' ? null : str(t.category),
          t.section == null || t.section === '' ? null : str(t.section),
          t.source == null || t.source === '' ? null : str(t.source),
          t.source_file == null || t.source_file === '' ? null : str(t.source_file),
          '',
          hash,
          str(t.created_at) || nowStamp(),
        )
        i++
        counts.budgets++
      }
    }

    if (groups.includes('planner')) {
      db.exec('DELETE FROM planner_items')
      const ins = db.prepare(
        'INSERT INTO planner_items (id, kind, name, monthly, note, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      )
      for (const p of rows('Planner')) {
        const kind = str(p.kind)
        if (kind !== 'fixed' && kind !== 'variable' && kind !== 'income') continue
        ins.run(
          num(p.id) || null,
          kind,
          str(p.name),
          num(p.monthly),
          p.note == null || p.note === '' ? null : str(p.note),
          num(p.sort_order),
        )
        counts.planner++
      }
    }

    if (groups.includes('properties')) {
      db.exec('DELETE FROM leases')
      db.exec('DELETE FROM property_entries')
      db.exec('DELETE FROM properties')
      const insP = db.prepare(
        'INSERT INTO properties (id, name, address, config, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      for (const p of rows('Properties')) {
        insP.run(
          num(p.id) || null,
          str(p.name),
          str(p.address),
          str(p.config) || '{}',
          str(p.created_at) || nowStamp(),
        )
        counts.properties++
      }
      const insL = db.prepare(`
        INSERT INTO leases
          (id, property_id, tenant, start_month, end_month, monthly_rent, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const l of rows('Leases')) {
        insL.run(
          num(l.id) || null,
          num(l.property_id),
          str(l.tenant),
          str(l.start_month),
          str(l.end_month),
          num(l.monthly_rent),
          l.note == null || l.note === '' ? null : str(l.note),
          str(l.created_at) || nowStamp(),
        )
      }
      const insE = db.prepare(`
        INSERT INTO property_entries
          (id, property_id, entry_date, kind, category, amount, note, paid, lease_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const e of rows('PropertyEntries')) {
        insE.run(
          num(e.id) || null,
          num(e.property_id),
          str(e.entry_date),
          str(e.kind) === 'income' ? 'income' : 'expense',
          str(e.category),
          Math.abs(num(e.amount)),
          e.note == null || e.note === '' ? null : str(e.note),
          e.paid == null || e.paid === '' ? 1 : num(e.paid) ? 1 : 0,
          numOrNull(e.lease_id),
        )
      }
      const cats = rows('PropertyCategories')
        .map((r) => str(r.category).trim())
        .filter(Boolean)
      if (cats.length) {
        db.prepare(
          `INSERT INTO app_settings (key, value) VALUES ('propertyCategories', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ).run(JSON.stringify([...new Set(cats)]))
      }
    }

    if (groups.includes('recipes')) {
      // Only text/macros are restored; existing photos on THIS machine (if any)
      // are lost on replace, since the file never carried them.
      db.exec('DELETE FROM recipes')
      const ins = db.prepare(`
        INSERT INTO recipes
          (id, title, category, cook_time, protein, carbs, fats, calories,
           instructions, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const RECIPE_CATS = ['breakfast', 'lunch', 'dinner', 'snack']
      for (const r of rows('Recipes')) {
        const cat = str(r.category)
        ins.run(
          num(r.id) || null,
          str(r.title),
          RECIPE_CATS.includes(cat) ? cat : 'dinner',
          num(r.cook_time),
          num(r.protein),
          num(r.carbs),
          num(r.fats),
          num(r.calories),
          str(r.instructions),
          str(r.description),
          str(r.created_at) || nowStamp(),
        )
        counts.recipes++
      }
    }

    if (groups.includes('workouts')) {
      // The document rides in a single 'doc' cell — parse it back and upsert the
      // one workout_state row. A malformed cell just leaves existing data alone.
      const docRow = rows('Workout')[0]
      const raw = docRow ? str(docRow.doc) : ''
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object' && Array.isArray(parsed.categories)) {
            db.prepare(
              `INSERT INTO workout_state (id, doc) VALUES (1, ?)
               ON CONFLICT(id) DO UPDATE SET doc = excluded.doc`,
            ).run(JSON.stringify(parsed))
            counts.workouts++
          }
        } catch {
          /* leave existing workout data untouched on a bad cell */
        }
      }
    }

    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  return counts
}
