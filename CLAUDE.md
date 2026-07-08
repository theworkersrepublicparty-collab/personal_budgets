# Personal Budgets — guidance for Claude Code

## Top design principle: cross-platform portability

This app must stay easily transferable from desktop to a future iPhone/Android
app (via Capacitor, wrapping the same React UI). This is the **most
important** constraint on any architectural decision here — when in doubt,
optimize for it over convenience.

Practical implications:

- **User data belongs in SQLite (`budget.db`)**, not in git-tracked files.
  SQLite is native on iOS/Android, so anything stored there carries over
  directly to a future mobile build. Git-tracked files only ever sync
  desktop-to-desktop (via `git pull`) — they can't reach a phone app, so they
  are the wrong place for anything the user edits at runtime (transactions,
  recipes, properties, etc).
- **Photos/blobs**: store inside SQLite as BLOB columns rather than loose
  files on disk, so a single `budget.db` file remains "everything you own" —
  same backup/restore story the README already documents.
- **Starter/seed content** (e.g. default budgets, starter recipes) *can* live
  in git as plain code/data files (see `server/seed.ts`,
  `server/recipe-seed.ts`). These are instructions that get materialized into
  local SQLite rows the first time the app runs against an empty table/db —
  the seed code travels via git, the resulting rows live locally per device.
- Prefer plain REST endpoints (Express) over anything that assumes a
  filesystem/git checkout is available at runtime, since a wrapped mobile
  build won't have one.

## Other notes

- `budget.db` (and `*.db-wal`/`*.db-shm`) is gitignored — it's private user
  data and never committed. See README's "Heads-up: your data is stored
  locally only" section.
