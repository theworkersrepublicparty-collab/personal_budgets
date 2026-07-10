// Thin wrapper around Node 24's built-in SQLite (node:sqlite).
// Synchronous API, zero native compilation. If you ever want to swap to
// better-sqlite3, only this file needs to change — the rest of the server
// uses the `db` export's prepare/exec interface.
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// budget.db lives at the project root, next to package.json. This single file
// IS your data — copy it anywhere to back up or move your numbers.
export const DB_PATH = join(__dirname, '..', 'budget.db')

export const db = new DatabaseSync(DB_PATH)

// Pragmas: WAL for safe concurrent reads/writes, foreign keys on.
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS budgets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      type       TEXT NOT NULL DEFAULT 'custom',
      config     TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id   INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
      txn_date    TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      amount      REAL NOT NULL,
      direction   TEXT NOT NULL,
      category    TEXT,
      section     TEXT,
      source_file TEXT,
      raw_row     TEXT,
      dedupe_hash TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Prevent importing the exact same row twice into the same budget.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_dedupe
      ON transactions(budget_id, dedupe_hash);

    CREATE INDEX IF NOT EXISTS idx_txn_budget_date
      ON transactions(budget_id, txn_date);

    -- Budget Planner: a separate yearly plan (fixed / variable expenses + income),
    -- independent of the imported-statement budgets above.
    CREATE TABLE IF NOT EXISTS planner_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      kind       TEXT NOT NULL,            -- 'fixed' | 'variable' | 'income'
      name       TEXT NOT NULL DEFAULT '',
      monthly    REAL NOT NULL DEFAULT 0,  -- yearly is always monthly * 12
      note       TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Rental properties you own/manage. The config (JSON) holds acquisition
    -- assumptions used for return metrics (purchase price, cash invested, etc.).
    CREATE TABLE IF NOT EXISTS properties (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      address    TEXT NOT NULL DEFAULT '',
      config     TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Per-property ledger: actual income and expenses logged over time.
    CREATE TABLE IF NOT EXISTS property_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      entry_date  TEXT NOT NULL,
      kind        TEXT NOT NULL,            -- 'income' | 'expense'
      category    TEXT NOT NULL DEFAULT '',
      amount      REAL NOT NULL DEFAULT 0,  -- always positive; kind gives the sign
      note        TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pentry_property
      ON property_entries(property_id, entry_date);

    -- A rental contract: generates one monthly rent row per month in its range,
    -- each starting unpaid until you check it off as collected.
    CREATE TABLE IF NOT EXISTS leases (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id  INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      tenant       TEXT NOT NULL DEFAULT '',
      start_month  TEXT NOT NULL,            -- 'YYYY-MM'
      end_month    TEXT NOT NULL,            -- 'YYYY-MM'
      monthly_rent REAL NOT NULL DEFAULT 0,
      note         TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  db.exec(`
    -- Simple key/value app settings (e.g. the shared property category list).
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Food recipes. Photos live here as blobs so the whole thing (like the
    -- rest of the app) is one portable file — the same format a future
    -- iPhone/Android build would read on-device.
    CREATE TABLE IF NOT EXISTS recipes (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT NOT NULL,
      category     TEXT NOT NULL DEFAULT 'dinner',  -- breakfast | lunch | dinner | snack
      cook_time    INTEGER NOT NULL DEFAULT 0,       -- minutes
      protein      REAL NOT NULL DEFAULT 0,          -- grams
      carbs        REAL NOT NULL DEFAULT 0,          -- grams
      fats         REAL NOT NULL DEFAULT 0,          -- grams
      calories     REAL NOT NULL DEFAULT 0,
      instructions TEXT NOT NULL DEFAULT '',
      description  TEXT NOT NULL DEFAULT '',
      image        BLOB,
      image_mime   TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
  `)

  // Columns added after property_entries shipped — add them if missing.
  ensureColumn('property_entries', 'paid', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn('property_entries', 'lease_id', 'INTEGER')

  // User-set account label on a transaction (e.g. "Chase Card" vs "Checking"),
  // filled in on import or when adding a row by hand. Distinct from source_file
  // (the auto-captured filename) — this one is yours to name.
  ensureColumn('transactions', 'source', 'TEXT')

  // The recipes table briefly shipped with an `image_path` column (files on
  // disk) before switching to blob storage for portability — add the blob
  // columns if an older recipes table is already on disk. image_path is left
  // in place, unused, rather than attempting a destructive column drop.
  ensureColumn('recipes', 'image', 'BLOB')
  ensureColumn('recipes', 'image_mime', 'TEXT')
}

// Idempotently add a column to an existing table (node:sqlite has no
// "ADD COLUMN IF NOT EXISTS", so we check PRAGMA table_info first).
function ensureColumn(table: string, column: string, def: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`)
  }
}
