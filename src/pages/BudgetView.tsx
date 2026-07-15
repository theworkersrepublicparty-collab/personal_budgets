import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type TxnInput } from '../lib/api'
import type { Budget, Kpis, Transaction, TxnFilters } from '../../shared/types'
import KpiCards from '../components/KpiCards'
import TxnTable from '../components/TxnTable'
import TxnForm from '../components/TxnForm'
import CategoryManager from '../components/CategoryManager'
import RulesManager from '../components/RulesManager'
import ImportWizard from '../components/ImportWizard'
import { CategoryChart, MonthlyByCategoryChart, MonthlyChart } from '../components/Charts'
import { money, shortDate } from '../lib/format'

// Starter category list used until the user saves their own.
const DEFAULT_CATEGORIES = [
  'Groceries',
  'Dining',
  'Transport',
  'Housing',
  'Utilities',
  'Shopping',
  'Health',
  'Entertainment',
  'Income',
  'Transfer',
  'Other',
]

export default function BudgetView() {
  const { id } = useParams()
  const budgetId = Number(id)

  const [budget, setBudget] = useState<Budget | null>(null)
  const [txns, setTxns] = useState<Transaction[]>([])
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [dateRange, setDateRange] = useState<{ min: string | null; max: string | null }>({
    min: null,
    max: null,
  })
  const [filters, setFilters] = useState<TxnFilters>({})
  const [importing, setImporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [managingCats, setManagingCats] = useState(false)
  const [managingRules, setManagingRules] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkCat, setBulkCat] = useState('')
  const [analyticsOpen, setAnalyticsOpen] = useState<boolean>(
    () => localStorage.getItem('analyticsOpen') !== '0', // default open
  )

  function toggleAnalytics() {
    setAnalyticsOpen((open) => {
      const next = !open
      localStorage.setItem('analyticsOpen', next ? '1' : '0')
      return next
    })
  }

  const currency = budget?.config.currency ?? 'USD'
  const isBusiness = budget?.type === 'business'

  // The budget's own category list (drives the row dropdowns, pie, and filter),
  // always shown alphabetized.
  const categoryList = [...(budget?.config.categories ?? DEFAULT_CATEGORIES)].sort((a, b) =>
    a.localeCompare(b),
  )

  // Distinct account labels the user has actually used, powering the Source
  // autocomplete on the add/edit form. Built live from the loaded transactions,
  // so it stays dynamic with no fixed list to maintain (empty until they add one).
  const sourceList = [
    ...new Set(
      txns.map((t) => t.source).filter((s): s is string => !!s && s.trim().length > 0),
    ),
  ].sort((a, b) => a.localeCompare(b))

  const load = useCallback(async () => {
    const [b, t, k, dr] = await Promise.all([
      api.getBudget(budgetId),
      api.transactions(budgetId, filters),
      api.kpis(budgetId, filters),
      api.dateRange(budgetId),
    ])
    setBudget(b)
    setTxns(t)
    setKpis(k)
    setDateRange({ min: dr.min, max: dr.max })
    setSelectedIds(new Set())
    setLoading(false)
  }, [budgetId, filters])

  useEffect(() => {
    load()
  }, [load])

  function patch(p: Partial<TxnFilters>) {
    setFilters((f) => ({ ...f, ...p }))
  }

  async function clearAll() {
    if (!confirm('Delete ALL transactions in this budget? The budget itself stays.')) return
    await api.clearTransactions(budgetId)
    load()
  }

  async function createTxn(data: TxnInput) {
    await api.createTxn(budgetId, data)
    setAdding(false)
    load()
  }

  async function saveEdit(data: TxnInput) {
    if (!editing) return
    await api.updateTxn(budgetId, editing.id, data)
    setEditing(null)
    load()
  }

  async function setCategory(txn: Transaction, category: string) {
    // Optimistic: update the row in place so the dropdown feels instant, then
    // refresh so the pie/KPIs recompute on the server.
    setTxns((prev) => prev.map((t) => (t.id === txn.id ? { ...t, category: category || null } : t)))
    await api.updateTxn(budgetId, txn.id, { category: category || null })
    load()
  }

  async function deleteTxn(txn: Transaction) {
    if (!confirm(`Delete this transaction?\n\n${txn.txn_date} · ${txn.description || '(no description)'} · ${money(txn.amount, currency)}`))
      return
    await api.deleteTxn(budgetId, txn.id)
    load()
  }

  async function saveCategories(next: string[]) {
    await api.updateBudget(budgetId, { config: { categories: next } })
    setManagingCats(false)
    load()
  }

  // --- category rules (manual; nothing is guessed) ---
  async function saveRules(rules: Record<string, string>) {
    await api.updateBudget(budgetId, { config: { rules } })
    load()
  }

  async function applyRules(rules: Record<string, string>) {
    setBusy(true)
    try {
      await api.updateBudget(budgetId, { config: { rules } }) // persist current edits first
      const res = await api.autoCategorize(budgetId) // then apply to blank rows
      alert(`Filled ${res.updated} blank transaction(s) using your ${res.ruleCount} rule(s).`)
      setManagingRules(false)
      await load()
    } finally {
      setBusy(false)
    }
  }



  // --- selection + bulk tagging ---
  function toggleRow(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll(ids: number[], select: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)))
      return next
    })
  }

  async function applyBulkCategory() {
    await api.bulkCategory(budgetId, [...selectedIds], bulkCat || null)
    setBulkCat('')
    load()
  }

  async function deleteSelected() {
    const n = selectedIds.size
    if (!confirm(`Delete ${n} selected transaction(s)? This cannot be undone.`)) return
    await api.bulkDelete(budgetId, [...selectedIds])
    load()
  }


  if (loading) return <p className="text-slate-400">Loading…</p>
  if (!budget) return <p className="text-slate-400">Budget not found.</p>

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/" className="text-sm text-slate-400 hover:text-ink">
            ← All budgets
          </Link>
          <h1 className="text-2xl font-bold">{budget.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setImporting(true)}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            ⬆ Import statement
          </button>
          <button
            onClick={() => setAdding(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            ＋ Add transaction
          </button>
          <button
            onClick={() => setManagingCats(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            🏷 Categories
          </button>
          <button
            onClick={() => setManagingRules(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            🪄 Auto-categorize
          </button>
          {txns.length > 0 && (
            <button
              onClick={clearAll}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
            >
              Clear data
            </button>
          )}
        </div>
      </div>

      {kpis && <KpiCards kpis={kpis} currency={currency} />}

      {/* Filters */}
      <div className="my-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <FilterField label="From">
          <input
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => patch({ from: e.target.value || undefined })}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </FilterField>
        <FilterField label="To">
          <input
            type="date"
            value={filters.to ?? ''}
            onChange={(e) => patch({ to: e.target.value || undefined })}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </FilterField>
        <FilterField label="Direction">
          <select
            value={filters.direction ?? ''}
            onChange={(e) =>
              patch({ direction: (e.target.value || undefined) as TxnFilters['direction'] })
            }
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="in">Money in</option>
            <option value="out">Money out</option>
          </select>
        </FilterField>
        <span className="self-end pb-1.5 text-xs text-slate-400">
          Tip: filter by date range here; filter Description / Category right in the table headers.
        </span>
        <div className="ml-auto flex items-center gap-2 self-end pb-0.5">
          {dateRange.max && (
            <button
              onClick={() => patch({ from: dateRange.max ?? undefined })}
              title="Your newest transaction. Click to set the From date to it."
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
            >
              🗓 Latest transaction:{' '}
              <span className="font-semibold text-ink">{shortDate(dateRange.max)}</span>
            </button>
          )}
          {Object.values(filters).some(Boolean) && (
            <button
              onClick={() => setFilters({})}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Analytics — collapsible so you can expand the charts or hide them to
          focus on the transaction list. */}
      {kpis && (
        <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <button
            onClick={toggleAnalytics}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
          >
            <span className="text-sm font-semibold text-slate-700">📊 Analytics</span>
            <span className="text-xs font-medium text-slate-400">
              {analyticsOpen ? 'Hide ▲' : 'Show ▼'}
            </span>
          </button>

          {analyticsOpen && (
            <div className="border-t border-slate-100 p-4">
              <div className="grid gap-4">
                <MonthlyByCategoryChart kpis={kpis} currency={currency} />
                <MonthlyChart kpis={kpis} currency={currency} />
                <CategoryChart kpis={kpis} currency={currency} />
              </div>

              {/* Business: per-section breakdown */}
              {isBusiness && kpis.bySection.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-slate-600">Sections</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {kpis.bySection.map((s) => (
                      <div
                        key={s.section}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <div className="font-semibold">{s.section}</div>
                        <div className="mt-2 flex justify-between text-sm">
                          <span className="text-money-in">{money(s.in, currency)} in</span>
                          <span className="text-money-out">{money(s.out, currency)} out</span>
                        </div>
                        <div className="mt-1 text-sm font-medium">Net {money(s.net, currency)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Transactions */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-600">Transactions ({txns.length})</h3>
      </div>

      {/* Bulk action bar — appears when rows are selected */}
      {selectedIds.size > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm">
          <span className="font-semibold text-indigo-900">{selectedIds.size} selected</span>
          <span className="text-slate-500">Set category to</span>
          <select
            value={bulkCat}
            onChange={(e) => setBulkCat(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">— Uncategorized —</option>
            {categoryList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={applyBulkCategory}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Apply to {selectedIds.size}
          </button>
          <button
            onClick={deleteSelected}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-money-out hover:bg-red-50"
          >
            🗑 Delete {selectedIds.size}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-white"
          >
            Clear selection
          </button>
        </div>
      )}

      <TxnTable
        txns={txns}
        currency={currency}
        showSection={isBusiness}
        categories={categoryList}
        selectedIds={selectedIds}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        onSetCategory={setCategory}
        onEdit={setEditing}
        onDelete={deleteTxn}
      />

      {importing && (
        <ImportWizard
          budgetId={budgetId}
          savedMapping={budget.config.mapping}
          onClose={() => setImporting(false)}
          onImported={load}
        />
      )}

      {adding && (
        <TxnForm
          categories={categoryList}
          sources={sourceList}
          onCancel={() => setAdding(false)}
          onSubmit={createTxn}
        />
      )}

      {editing && (
        <TxnForm
          existing={editing}
          categories={categoryList}
          sources={sourceList}
          onCancel={() => setEditing(null)}
          onSubmit={saveEdit}
        />
      )}

      {managingCats && (
        <CategoryManager
          categories={categoryList}
          onCancel={() => setManagingCats(false)}
          onSave={saveCategories}
        />
      )}

      {managingRules && (
        <RulesManager
          rules={budget.config.rules ?? {}}
          categories={categoryList}
          busy={busy}
          onCancel={() => setManagingRules(false)}
          onSaveRules={saveRules}
          onApply={applyRules}
        />
      )}
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col">
      <span className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      {children}
    </label>
  )
}
