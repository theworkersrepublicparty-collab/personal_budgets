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
> an **empty** database. To use your data on another machine, copy your
> `budget.db` over yourself — or use the built-in **💾 Backup** button (see
> **[Your data & backups](#your-data--backups)** below).

# 🐶 JQTools

A **local-only** personal-finance workspace. Track your spending, plan your
year, manage rental properties, size up deals, and keep your recipes — all in
one app. Nothing ever leaves your machine; everything lives in a single file
you control.

## What you can do

- **🧮 Budgets** — Import bank / credit-card statements (CSV or Excel), see KPIs
  (money in / out, net, credits / debits) and charts, then filter, search,
  categorize, and bulk-edit every transaction. A *latest-transaction* hint shows
  where to start a date range.
- **📅 Yearly Planner** — Lay out fixed expenses, variable expenses, and income;
  monthly amounts roll up to a yearly view.
- **🏠 Properties** — Log income and expenses per rental, add leases that
  auto-generate each month's rent (tick it off when collected), and see return
  metrics.
- **🧮 Deal Estimator** — Quick rental-deal calculator for sizing up a purchase.
- **🍽️ Food Recipes** — Recipes with photos, macros, and categories. Import
  macros from a Cronometer export, crop / zoom photos as you upload them, and
  select multiple recipes to delete at once.
- **💾 Backup & Restore** — Download your data as one Excel file (pick which
  tabs to include), then restore it on another computer to pick up where you
  left off.

## The big idea (budgets)

Every "budget" is the **same engine**. A statement is just rows of
*date / description / amount*. You map a file's column headers **once**, and
from then on it imports automatically. **Day-to-Day Living** and **Business**
are just pre-made instances; a **Custom** budget is the bare generic one — feed
it any file's headers.

## Run it

```bash
npm install      # first time only
npm run dev      # starts the API + web app together
```

Then open **http://localhost:5173** in your browser.

> First launch creates starter budgets and recipes automatically. Try importing
> the sample files in `samples/` to see it in action.

| Command | What it does |
|---------|--------------|
| `npm run dev` | Run everything (API on :3001, web on :5173) |
| `npm run build` | Build the web app for production into `dist/` |
| `npm run start` | Run just the API server |

## Your data & backups

Everything is in **one file: `budget.db`** in this folder (created on first
run). Two ways to keep it safe or move it:

1. **In-app (easiest):** click **💾 Backup** in the top bar → choose the tabs →
   download one Excel file. To move to another computer, open the app there and
   use the **Restore** side of the same window. (Recipe *photos* aren't included
   in the Excel file — see below.)
2. **Copy the file:** copy `budget.db` somewhere safe, or into the project
   folder on another PC. This is *everything*, photos included.

To **start over**, delete `budget.db` and run again — it recreates the starter
content.

## How to import a statement

1. Open a budget → **⬆ Import statement**.
2. Drop in a `.csv` or `.xlsx` from your bank / credit card.
3. The app guesses which column is the date, amount, etc. — fix anything wrong.
   (One signed amount column, or separate debit / credit columns — both work.)
4. Import. Re-importing the same file is safe — **duplicates are skipped**
   automatically (matched on date + amount + description).

Your mapping is remembered per budget, so next month's import from the same bank
is one click.

## Tech

React + Vite + TypeScript · Express · `node:sqlite` (Node 24 built-in, no native
build step) · Tailwind · TanStack Table · Recharts · papaparse + SheetJS.

## Project layout

```
server/          Express API
  db.ts            SQLite wrapper + schema
  parse.ts         CSV + XLSX -> rows
  ingest.ts        column mapping -> normalized transactions (+ dedupe)
  backup.ts        Excel backup / restore, per tab
  index.ts         routes
  seed.ts          starter budgets · recipe-seed.ts starter recipes
src/             React app
  pages/           Budgets, Planner, Properties, Deal Estimator, Recipes
  components/       KpiCards, TxnTable, ImportWizard, Charts,
                    BackupRestore, RecipePhotoField, …
  lib/             api client + formatting
shared/types.ts   types shared by server + app
samples/          example statements to try
```

## Roadmap

- Budget targets / alerts, recurring-transaction detection, multi-currency.
- A **Workouts** tab — log and track your training alongside everything else.
