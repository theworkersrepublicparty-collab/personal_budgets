import { useState } from 'react'
import type { Transaction } from '../../shared/types'
import type { TxnInput } from '../lib/api'

// Add or edit a single transaction by hand. The user types a positive amount
// and picks In/Out; we turn that into the signed amount the rest of the app uses.
export default function TxnForm({
  existing,
  categories,
  onCancel,
  onSubmit,
}: {
  existing?: Transaction | null
  categories: string[]
  onCancel: () => void
  onSubmit: (data: TxnInput) => Promise<void>
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(existing?.txn_date || today)
  const [description, setDescription] = useState(existing?.description ?? '')
  const [amount, setAmount] = useState(
    existing ? String(Math.abs(existing.amount)) : '',
  )
  const [direction, setDirection] = useState<'in' | 'out'>(
    existing ? (existing.amount >= 0 ? 'in' : 'out') : 'out',
  )
  const [category, setCategory] = useState(existing?.category ?? '')
  const [source, setSource] = useState(existing?.source ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const num = Number(amount)
    if (!date || Number.isNaN(num) || num === 0) {
      setError('Enter a date and a non-zero amount.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        txn_date: date,
        description: description.trim(),
        amount: direction === 'out' ? -Math.abs(num) : Math.abs(num),
        category: category || null,
        source: source.trim() || null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
      setSaving(false)
    }
  }

  return (
    <Backdrop onClose={onCancel}>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">
          {existing ? 'Edit transaction' : 'Add transaction'}
        </h2>

        <div className="grid gap-3">
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Description">
            <input
              type="text"
              value={description}
              placeholder="e.g. Groceries at Kroger"
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>

          <div className="flex gap-3">
            <Field label="Amount">
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                placeholder="0.00"
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Direction">
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'in' | 'out')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="out">Money out</option>
                <option value="in">Money in</option>
              </select>
            </Field>
          </div>

          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Uncategorized —</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {category && !categories.includes(category) && (
                <option value={category}>{category} (from import)</option>
              )}
            </select>
          </Field>

          <Field label="Source / account (optional)">
            <input
              type="text"
              value={source}
              placeholder="e.g. Chase Card"
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {error && <p className="mt-3 text-sm text-money-out">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Add'}
          </button>
        </div>
      </form>
    </Backdrop>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-1 flex-col">
      <span className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      {children}
    </label>
  )
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}
