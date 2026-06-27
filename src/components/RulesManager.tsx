import { useState } from 'react'

type Rule = { keyword: string; category: string }

// You write the rules (keyword -> category) by hand. Clicking "Apply rules"
// fills in any BLANK rows whose description contains a keyword. Nothing is ever
// guessed or auto-learned — only the rules you type here are used.
export default function RulesManager({
  rules,
  categories,
  busy,
  onCancel,
  onSaveRules,
  onApply,
}: {
  rules: Record<string, string>
  categories: string[]
  busy: boolean
  onCancel: () => void
  onSaveRules: (next: Record<string, string>) => Promise<void>
  onApply: (next: Record<string, string>) => Promise<void>
}) {
  const [list, setList] = useState<Rule[]>(
    Object.entries(rules).map(([keyword, category]) => ({ keyword, category })),
  )

  function update(i: number, patch: Partial<Rule>) {
    setList(list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function remove(i: number) {
    setList(list.filter((_, idx) => idx !== i))
  }
  function addRow() {
    setList([...list, { keyword: '', category: categories[0] ?? '' }])
  }

  function toDict(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const r of list) {
      const k = r.keyword.trim().toLowerCase()
      if (k && r.category) out[k] = r.category
    }
    return out
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[80vh] max-h-[92vh] min-h-[400px] w-[900px] min-w-[400px] max-w-[94vw] resize flex-col overflow-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold">Auto-categorize rules</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          You write the rules — a keyword and the category it maps to. <b>Apply rules</b> tags any
          transaction whose description contains that keyword. It only fills <b>blank</b> rows, so
          your manual tags are never overwritten. Nothing is guessed.
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              No rules yet. Add one below — e.g. keyword “amazon” → Shopping.
            </p>
          )}
          <div className="grid gap-2">
            {list.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={r.keyword}
                  placeholder="keyword e.g. amazon"
                  onChange={(e) => update(i, { keyword: e.target.value })}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
                <span className="text-slate-400">→</span>
                <select
                  value={r.category}
                  onChange={(e) => update(i, { category: e.target.value })}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {!categories.includes(r.category) && r.category && (
                    <option value={r.category}>{r.category}</option>
                  )}
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label="Remove rule"
                  className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={addRow}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              ＋ Add a rule
            </button>
            {list.length > 0 && (
              <button
                type="button"
                onClick={() => setList([])}
                className="text-sm font-medium text-money-out hover:underline"
              >
                Clear all rules
              </button>
            )}
          </div>
        </div>
        <p className="mt-1 text-right text-[10px] text-slate-300">drag the bottom-right corner to resize ⟲</p>

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => onApply(toDict())}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Working…' : '🪄 Auto-categorize now'}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSaveRules(toDict())}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Save rules
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
