import { useRef, useState } from 'react'
import { api, type ParseResponse } from '../lib/api'
import type { ColumnMapping, ImportResult } from '../../shared/types'

type Step = 'upload' | 'map' | 'done'

export default function ImportWizard({
  budgetId,
  savedMapping,
  onClose,
  onImported,
}: {
  budgetId: number
  savedMapping?: ColumnMapping
  onClose: () => void
  onImported: () => void
}) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParseResponse | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(f: File) {
    setError(null)
    setBusy(true)
    setFile(f)
    try {
      const res = await api.parse(f)
      setParsed(res)
      // Prefer the budget's previously-saved mapping if its columns still exist.
      const useSaved =
        savedMapping &&
        [savedMapping.date, savedMapping.description].every(
          (h) => !h || res.headers.includes(h),
        )
      setMapping(useSaved ? savedMapping! : res.suggestedMapping)
      setStep('map')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function doImport() {
    if (!file || !mapping) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.import(budgetId, file, mapping, source.trim() || undefined)
      setResult(res)
      setStep('done')
      onImported()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function set<K extends keyof ColumnMapping>(key: K, value: ColumnMapping[K]) {
    setMapping((m) => (m ? { ...m, [key]: value } : m))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="mt-10 w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold">Import statement</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-ink">
            ✕
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-money-out">{error}</div>
          )}

          {step === 'upload' && (
            <div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const f = e.dataTransfer.files?.[0]
                  if (f) handleFile(f)
                }}
                onClick={() => inputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center hover:border-slate-400"
              >
                <div className="text-4xl">📄</div>
                <p className="mt-3 font-medium">Drop a CSV or Excel file here</p>
                <p className="mt-1 text-sm text-slate-400">or click to browse · .csv, .xlsx</p>
                {busy && <p className="mt-3 text-sm text-slate-400">Reading file…</p>}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
            </div>
          )}

          {step === 'map' && parsed && mapping && (
            <>
              <MapStep
                parsed={parsed}
                mapping={mapping}
                set={set}
                setMode={(mode) => set('amountMode', mode)}
              />
              <label className="mt-4 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  Source / account for this file (optional)
                </span>
                <input
                  type="text"
                  value={source}
                  placeholder="e.g. Chase Card — applied to every row in this file"
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </>
          )}

          {step === 'done' && result && (
            <div className="py-8 text-center">
              <div className="text-4xl">✅</div>
              <p className="mt-3 text-lg font-semibold">Imported {result.inserted} transactions</p>
              <p className="mt-1 text-sm text-slate-400">
                {result.skipped > 0
                  ? `${result.skipped} duplicate row(s) skipped.`
                  : 'No duplicates found.'}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 border-t border-slate-200 px-5 py-3">
          <div>
            {step === 'map' && (
              <button
                onClick={() => setStep('upload')}
                className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
              >
                ← Choose another file
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {step === 'map' && (
              <button
                onClick={doImport}
                disabled={busy}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {busy ? 'Importing…' : `Import ${parsed?.rowCount ?? ''} rows`}
              </button>
            )}
            {step === 'done' && (
              <button
                onClick={onClose}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MapStep({
  parsed,
  mapping,
  set,
  setMode,
}: {
  parsed: ParseResponse
  mapping: ColumnMapping
  set: <K extends keyof ColumnMapping>(key: K, value: ColumnMapping[K]) => void
  setMode: (mode: 'single' | 'debitcredit') => void
}) {
  const options = parsed.headers
  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Tell the app which column is which. We've guessed based on your headers — adjust anything
        that's wrong. This mapping is saved, so next time it's automatic.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date column">
          <Select value={mapping.date} onChange={(v) => set('date', v)} options={options} />
        </Field>
        <Field label="Description column">
          <Select
            value={mapping.description}
            onChange={(v) => set('description', v)}
            options={options}
          />
        </Field>

        <Field label="How are amounts stored?">
          <select
            value={mapping.amountMode}
            onChange={(e) => setMode(e.target.value as 'single' | 'debitcredit')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="single">One amount column (signed)</option>
            <option value="debitcredit">Separate debit + credit columns</option>
          </select>
        </Field>

        {mapping.amountMode === 'single' ? (
          <>
            <Field label="Amount column">
              <Select value={mapping.amount} onChange={(v) => set('amount', v)} options={options} />
            </Field>
            <Field label="A positive number means…">
              <select
                value={mapping.positiveMeans}
                onChange={(e) => set('positiveMeans', e.target.value as 'in' | 'out')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="in">Money IN (deposit / income)</option>
                <option value="out">Money OUT (spending)</option>
              </select>
            </Field>
          </>
        ) : (
          <>
            <Field label="Debit (money out) column">
              <Select value={mapping.debit} onChange={(v) => set('debit', v)} options={options} />
            </Field>
            <Field label="Credit (money in) column">
              <Select value={mapping.credit} onChange={(v) => set('credit', v)} options={options} />
            </Field>
          </>
        )}

        <Field label="Category column (optional)">
          <Select value={mapping.category} onChange={(v) => set('category', v)} options={options} />
        </Field>
      </div>

      <div className="mt-5">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Preview ({parsed.rowCount} rows total)
        </h4>
        <div className="max-h-48 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr>
                {parsed.headers.map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-1 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.slice(0, 8).map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {parsed.headers.map((h) => (
                    <td key={h} className="whitespace-nowrap px-2 py-1 text-slate-600">
                      {r[h]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string | null
  onChange: (v: string | null) => void
  options: string[]
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
    >
      <option value="">— none —</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}
