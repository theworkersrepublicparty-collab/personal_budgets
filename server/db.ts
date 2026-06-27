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
  `)
}
