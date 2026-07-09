import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { PlannerItem, PlannerKind } from '../../shared/types'
import { money } from '../lib/format'

// A standalone yearly plan: fixed expenses, variable expenses, and income.
// Yearly is always monthly × 12. Totals + "extra" update live as you type.
export default function Planner() {
  const [items, setItems] = useState<PlannerItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setItems(await api.planner())
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const fixed = items.filter((i) => i.kind === 'fixed')
  const variable = items.filter((i) => i.kind === 'variable')
  const income = items.filter((i) => i.kind === 'income')

  const sum = (list: PlannerItem[]) => list.reduce((t, i) => t + (Number(i.monthly) || 0), 0)
  const fixedMo = sum(fixed)
  const varMo = sum(variable)
  const incomeMo = sum(income)
  const expMo = fixedMo + varMo
  const extraMo = incomeMo - expMo

  // Local edit (live totals) without a round-trip; persist on blur.
  function setLocal(id: number, patch: Partial<PlannerItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }
  function save(id: number, patch: Partial<{ name: string; monthly: number; note: string | null }>) {
    api.updatePlannerItem(id, patch)
  }
  async function addRow(kind: PlannerKind) {
    await api.createPlannerItem(kind)
    load()
  }
  async function removeRow(id: number) {
    await api.deletePlannerItem(id)
    load()
  }

  if (loading) return <p className="text-slate-400">Loading…</p>

  return (
    <div>
      <div className="mb-1">
        <Link to="/" className="text-sm text-slate-400 hover:text-ink">
          ← All budgets
        </Link>
      </div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📅 Yearly Planner</h1>
          <p className="text-sm text-slate-400">
            Your yearly plan — separate from imported statements. Yearly = monthly × 12.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Fixed Expenses"
          total={fixedMo}
          rows={fixed}
          onAdd={() => addRow('fixed')}
          onLocal={setLocal}
          onSave={save}
          onRemove={removeRow}
        />
        <Section
          title="Variable Expenses"
          total={varMo}
          rows={variable}
          onAdd={() => addRow('variable')}
          onLocal={setLocal}
          onSave={save}
          onRemove={removeRow}
        />
      </div>

      <div className="mt-4">
        <Section
          title="Income"
          total={incomeMo}
          rows={income}
          onAdd={() => addRow('income')}
          onLocal={setLocal}
          onSave={save}
          onRemove={removeRow}
          accent="in"
        />
      </div>

      {/* Summary */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Income" mo={incomeMo} yr={incomeMo * 12} tone="in" />
        <SummaryCard label="Total Expenses" mo={expMo} yr={expMo * 12} tone="out" />
        <SummaryCard label="Extra (Income − Expenses)" mo={extraMo} yr={extraMo * 12} tone="net" />
      </div>
    </div>
  )
}

function Section({
  title,
  total,
  rows,
  onAdd,
  onLocal,
  onSave,
  onRemove,
  accent = 'out',
}: {
  title: string
  total: number
  rows: PlannerItem[]
  onAdd: () => void
  onLocal: (id: number, patch: Partial<PlannerItem>) => void
  onSave: (id: number, patch: Partial<{ name: string; monthly: number; note: string | null }>) => void
  onRemove: (id: number) => void
  accent?: 'in' | 'out'
}) {
  const amountClass = accent === 'in' ? 'text-money-in' : 'text-money-out'
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="text-sm font-semibold">
          {money(total)}/mo · {money(total * 12)}/yr
        </span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[10px] uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-1 font-semibold">Item</th>
            <th className="px-2 py-1 text-right font-semibold">Month</th>
            <th className="px-2 py-1 text-right font-semibold">Year</th>
            <th className="px-2 py-1 font-semibold">Note</th>
            <th className="px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-50">
              <td className="px-4 py-1">
                <input
                  value={r.name}
                  placeholder="name…"
                  onChange={(e) => onLocal(r.id, { name: e.target.value })}
                  onBlur={(e) => onSave(r.id, { name: e.target.value })}
                  className="w-full rounded border border-transparent px-1.5 py-1 hover:border-slate-200 focus:border-slate-300 focus:outline-none"
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="number"
                  step="0.01"
                  value={r.monthly === 0 ? '' : r.monthly}
                  placeholder="0.00"
                  onChange={(e) => onLocal(r.id, { monthly: parseFloat(e.target.value) || 0 })}
                  onBlur={(e) => onSave(r.id, { monthly: parseFloat(e.target.value) || 0 })}
                  className={
                    'w-24 rounded border border-transparent px-1.5 py-1 text-right hover:border-slate-200 focus:border-slate-300 focus:outline-none ' +
                    amountClass
                  }
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="number"
                  step="0.01"
                  value={r.monthly === 0 ? '' : Math.round((Number(r.monthly) || 0) * 12 * 100) / 100}
                  placeholder="0.00"
                  onChange={(e) => onLocal(r.id, { monthly: (parseFloat(e.target.value) || 0) / 12 })}
                  onBlur={(e) => onSave(r.id, { monthly: (parseFloat(e.target.value) || 0) / 12 })}
                  className={
                    'w-24 rounded border border-transparent px-1.5 py-1 text-right hover:border-slate-200 focus:border-slate-300 focus:outline-none ' +
                    amountClass
                  }
                />
              </td>
              <td className="px-2 py-1">
                <input
                  value={r.note ?? ''}
                  placeholder="—"
                  onChange={(e) => onLocal(r.id, { note: e.target.value })}
                  onBlur={(e) => onSave(r.id, { note: e.target.value || null })}
                  className="w-full rounded border border-transparent px-1.5 py-1 text-xs text-slate-500 hover:border-slate-200 focus:border-slate-300 focus:outline-none"
                />
              </td>
              <td className="px-2 py-1 text-right">
                <button
                  onClick={() => onRemove(r.id)}
                  aria-label="Delete row"
                  className="rounded px-1.5 py-1 text-xs text-slate-300 hover:bg-red-50 hover:text-money-out"
                >
                  🗑
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2">
        <button onClick={onAdd} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
          ＋ Add row
        </button>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  mo,
  yr,
  tone,
}: {
  label: string
  mo: number
  yr: number
  tone: 'in' | 'out' | 'net'
}) {
  const color =
    tone === 'in' ? 'text-money-in' : tone === 'out' ? 'text-money-out' : mo >= 0 ? 'text-money-in' : 'text-money-out'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={'mt-1 text-2xl font-bold ' + color}>{money(mo)}</div>
      <div className="text-xs text-slate-400">per month</div>
      <div className={'mt-2 text-sm font-semibold ' + color}>{money(yr)} / year</div>
    </div>
  )
}
