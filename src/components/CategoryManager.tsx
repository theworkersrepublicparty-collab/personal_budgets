import { useState } from 'react'

// Edit the budget's own category list. This list feeds the row dropdowns,
// the pie chart, and the category filter. Removing a category here does NOT
// touch transactions already tagged with it — it just stops offering it.
export default function CategoryManager({
  categories,
  onCancel,
  onSave,
}: {
  categories: string[]
  onCancel: () => void
  onSave: (next: string[]) => Promise<void>
}) {
  const [list, setList] = useState<string[]>(categories)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  function add() {
    const name = draft.trim()
    if (!name) return
    if (list.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setDraft('')
      return
    }
    setList([...list, name])
    setDraft('')
  }

  function remove(name: string) {
    setList(list.filter((c) => c !== name))
  }

  async function save() {
    setSaving(true)
    await onSave(list)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="mb-1 text-lg font-bold">Manage categories</h2>
        <p className="mb-4 text-sm text-slate-500">
          Keep this list short — these are the slices of your pie chart.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            placeholder="New category…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={add}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Add
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {list.length === 0 && (
            <span className="text-sm text-slate-400">No categories yet — add some above.</span>
          )}
          {list.map((c) => (
            <span
              key={c}
              className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm"
            >
              {c}
              <button
                type="button"
                onClick={() => remove(c)}
                aria-label={`Remove ${c}`}
                className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-300 hover:text-slate-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save list'}
          </button>
        </div>
      </div>
    </div>
  )
}
