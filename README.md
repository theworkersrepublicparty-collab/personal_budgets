# 💰 Personal Budgets

A **local-only** budget tracker. Import your bank / credit-card statements
(CSV or Excel), see KPIs on top (money in / out, credits / debits, net), and
browse every transaction. Nothing ever leaves your machine — all your data
lives in a single file you control.

## The big idea

All three "budgets" are the **same engine**. A statement is just rows of
*date / description / amount*. You map a file's column headers **once**, and
from then on it processes automatically. So:

- **Day-to-Day Living** and **Website / Business** are just pre-made *instances*.
- A **Custom** budget is the bare generic instance — feed it any file's headers.

## Run it

```bash
npm install      # first time only
npm run dev      # starts the API + web app together
```

Then open **http://localhost:5173** in your browser.

> First launch creates two starter budgets automatically. Try importing the
> sample files in `samples/` to see it in action.

Other commands:

| Command | What it does |
|---------|--------------|
| `npm run dev` | Run everything (API on :3001, web on :5173) |
| `npm run build` | Build the web app for production into `dist/` |
| `npm run start` | Run just the API server |

## Where are my numbers? (Backups)

All your data is in **one file: `budget.db`** in this folder (created on first
run). That's it. To back up or move your data:

- **Back up:** copy `budget.db` somewhere safe (USB, Dropbox, etc.).
- **Restore / move to another PC:** copy `budget.db` back into the project folder.
- **Start over:** delete `budget.db` and run again — it recreates empty budgets.

It uses **SQLite**, the same database iPhones use natively — which is what makes
the "put it on my iPhone someday" plan realistic.

## How to import a statement

1. Open a budget → **⬆ Import statement**.
2. Drop in a `.csv` or `.xlsx` from your bank / credit card.
3. The app guesses which column is the date, amount, etc. — fix anything wrong.
   - Single signed amount column? Pick it and say whether **+** means money in
     or out.
   - Separate **debit / credit** columns? Switch the mode and pick both.
4. Import. Re-importing the same file is safe — **duplicates are skipped**
   automatically (matched on date + amount + description).

Your mapping is remembered per budget, so next month's import from the same bank
is one click.

## Tech

React + Vite + TypeScript · Express · `node:sqlite` (Node 24 built-in, no native
build step) · Tailwind · TanStack Table · Recharts · papaparse + SheetJS.

## Project layout

```
server/        Express API
  db.ts          SQLite wrapper + schema
  parse.ts       CSV + XLSX -> rows
  ingest.ts      column mapping -> normalized transactions (+ dedupe)
  index.ts       routes
  seed.ts        starter budgets
src/           React app
  pages/         Home, BudgetView
  components/     KpiCards, TxnTable, ImportWizard, Charts
  lib/           api client + formatting
shared/types.ts  types shared by server + app
samples/         example statements to try
```

## Roadmap (kept easy by the current design)

- Wrap into a desktop window (Tauri/Electron) and an iPhone app (Capacitor) —
  the React UI and SQLite carry over.
- Budget targets / alerts, recurring-transaction detection, multi-currency.
