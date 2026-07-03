> ## ⚠️ For educational purposes only
>
> This project is a personal, open-source software project shared **for
> educational and informational purposes only**. It is **not** financial,
> investment, tax, accounting, or legal advice, and nothing in this app or its
> documentation should be relied on as such.
>
> The app does **not** tell you how to budget, how to invest, or what to do
> with your money. It is simply a tool for organizing and viewing statement
> data you enter yourself. Any decisions you make are your own — for advice
> about your specific situation, consult a qualified professional (a licensed
> financial advisor, accountant, or attorney).
>
> The software is provided "as is", without warranty of any kind. The authors
> accept no liability for any loss or damages arising from its use. Always
> verify any numbers against your official bank and financial records.

> ## 💾 Heads-up: your data is stored locally only
>
> This app keeps everything in a single file — **`budget.db`** — that lives on
> **your** computer and never gets uploaded anywhere. That file is deliberately
> **not** included when you clone this project from GitHub.
>
> **What that means:** cloning the code gives you the *app*, but it starts with
> an **empty** database. To use your data on another machine, you copy the
> `budget.db` file over yourself.
>
> **Desktop-to-desktop, step by step:**
>
> ```bash
> # 1. On the new computer, clone the app from GitHub
> git clone https://github.com/theworkersrepublicparty-collab/personal_budgets.git
> cd personal_budgets
> npm install
>
> # 2. Copy your budget.db from the old computer into this folder
> #    (via USB stick, Dropbox, a file share, etc. — however you like)
>
> # 3. Run it — your data will be there
> npm run dev
> ```
>
> If you **skip step 2**, the app still runs — it just creates a fresh, empty
> database so you can start over. Your financial data only ever moves when
> *you* move that one file. See **[Where are my numbers? (Backups)](#where-are-my-numbers-backups)**
> below for more.

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
