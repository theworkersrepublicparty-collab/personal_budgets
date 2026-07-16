import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Budget, BudgetType } from '../../shared/types'

const TYPE_META: Record<BudgetType, { label: string; emoji: string; blurb: string }> = {
  living: { label: 'Living', emoji: '🏠', blurb: 'Day-to-day personal spending' },
  business: { label: 'Business', emoji: '🌐', blurb: 'Website / business cash flow, by section' },
  custom: { label: 'Custom', emoji: '🧩', blurb: 'Generic instance — map any file headers' },
}

export default function Home() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<BudgetType>('custom')

  async function refresh() {
    setBudgets(await api.listBudgets())
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await api.createBudget(name.trim(), type)
    setName('')
    setType('custom')
    setCreating(false)
    refresh()
  }

  async function remove(id: number, label: string) {
    if (!confirm(`Delete "${label}" and all its transactions? This cannot be undone.`)) return
    await api.deleteBudget(id)
    refresh()
  }

  async function rename(id: number, label: string) {
    const name = prompt('Rename budget:', label)
    if (!name || !name.trim() || name.trim() === label) return
    await api.updateBudget(id, { name: name.trim() })
    refresh()
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your budgets</h1>
        <button
          onClick={() => setCreating((c) => !c)}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          {creating ? 'Cancel' : '+ New budget'}
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="mb-1 block text-xs font-medium text-slate-500">Name</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chase Checking, Side Project"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-500">Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as BudgetType)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="custom">Custom (generic)</option>
                <option value="living">Living</option>
                <option value="business">Business</option>
              </select>
            </label>
            <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              Create
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Every budget is the same engine — you import a file and map its columns once. "Custom"
            is the bare instance creator; "Living" and "Business" just start with sensible labels.
          </p>
        </form>
      )}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : budgets.length === 0 ? (
        <p className="text-slate-400">No budgets yet. Create one to get started.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((b) => {
            const meta = TYPE_META[b.type] ?? TYPE_META.custom
            return (
              <div
                key={b.id}
                className="group relative rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
              >
                <Link to={`/budget/${b.id}`} className="block">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-2xl">{meta.emoji}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {meta.label}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold">{b.name}</h2>
                  <p className="mt-1 text-sm text-slate-400">{meta.blurb}</p>
                </Link>
                <div className="absolute right-3 top-3 hidden items-center gap-2 group-hover:flex">
                  <button
                    onClick={() => rename(b.id, b.name)}
                    className="text-xs text-slate-300 hover:text-slate-600"
                    title="Rename budget"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => remove(b.id, b.name)}
                    className="text-xs text-slate-300 hover:text-money-out"
                    title="Delete budget"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
