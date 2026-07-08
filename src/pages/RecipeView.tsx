import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type RecipeInput } from '../lib/api'
import type { Recipe, RecipeCategory } from '../../shared/types'

const CATEGORIES: { key: RecipeCategory; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { key: 'lunch', label: 'Lunch', emoji: '🥪' },
  { key: 'dinner', label: 'Dinner', emoji: '🍽️' },
  { key: 'snack', label: 'Snacks', emoji: '🍿' },
]

export default function RecipeView() {
  const { id } = useParams()
  const recipeId = Number(id)
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await api.getRecipe(recipeId)
    setRecipe(r)
    setLoading(false)
  }, [recipeId])
  useEffect(() => {
    load()
  }, [load])

  async function handleDelete() {
    if (!confirm('Delete this recipe?')) return
    await api.deleteRecipe(recipeId)
    navigate('/recipes')
  }

  async function handleCronometerImport(file: File) {
    setImporting(true)
    setImportMsg(null)
    try {
      const res = await api.importCronometer(recipeId, file)
      setRecipe(res.recipe)
      setImportMsg(`Imported macros from ${res.rowsRead} row(s): ${res.calories} kcal · P${res.protein} C${res.carbs} F${res.fats}`)
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  if (loading) return <p className="text-slate-400">Loading…</p>
  if (!recipe) return <p className="text-slate-400">Recipe not found.</p>

  const cat = CATEGORIES.find((c) => c.key === recipe.category)

  return (
    <div>
      <div className="mb-1 print:hidden">
        <Link to="/recipes" className="text-sm text-slate-400 hover:text-ink">
          ← All recipes
        </Link>
      </div>

      {editing ? (
        <EditRecipe
          recipe={recipe}
          onCancel={() => setEditing(false)}
          onSaved={(r) => {
            setRecipe(r)
            setEditing(false)
          }}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {cat?.emoji} {cat?.label}
              </span>
              <h1 className="text-2xl font-bold">{recipe.title}</h1>
              {recipe.description && <p className="mt-1 text-sm text-slate-500">{recipe.description}</p>}
            </div>
            <div className="flex gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                🖨 Print / Save as PDF
              </button>
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                ✎ Edit
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-money-out hover:bg-red-50"
              >
                🗑 Delete
              </button>
            </div>
          </div>

          {recipe.has_image && (
            <img
              src={api.recipeImageUrl(recipe.id)}
              alt={recipe.title}
              className="mb-5 max-h-96 w-full rounded-xl border border-slate-200 object-cover print:max-h-64"
            />
          )}

          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 print:grid-cols-5 print:gap-2">
            <Stat label="Cook time" value={recipe.cook_time > 0 ? `${recipe.cook_time} min` : '—'} />
            <Stat label="Calories" value={recipe.calories > 0 ? `${recipe.calories} kcal` : '—'} />
            <Stat label="Protein" value={`${recipe.protein} g`} color="text-emerald-600" />
            <Stat label="Carbs" value={`${recipe.carbs} g`} color="text-amber-600" />
            <Stat label="Fats" value={`${recipe.fats} g`} color="text-sky-600" />
          </div>

          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 print:border-0 print:p-0">
            <h2 className="mb-2 text-sm font-semibold text-slate-600">How to make it / prep</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {recipe.instructions || 'No instructions added yet.'}
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 print:hidden">
            <h2 className="mb-1 text-sm font-semibold text-slate-600">Import macros from Cronometer</h2>
            <p className="mb-2 text-xs text-slate-400">
              Export this recipe (or the day's diary) as CSV from Cronometer, then upload it here —
              protein / carbs / fat / calories are summed across the file's rows and filled in above.
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleCronometerImport(file)
                e.target.value = ''
              }}
              className="text-xs"
            />
            {importing && <p className="mt-2 text-xs text-slate-400">Importing…</p>}
            {importMsg && <p className="mt-2 text-xs text-slate-600">{importMsg}</p>}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-0.5 text-lg font-bold ${color ?? 'text-ink'}`}>{value}</div>
    </div>
  )
}

function EditRecipe({
  recipe,
  onCancel,
  onSaved,
}: {
  recipe: Recipe
  onCancel: () => void
  onSaved: (r: Recipe) => void
}) {
  const [f, setF] = useState({
    title: recipe.title,
    category: recipe.category,
    cook_time: String(recipe.cook_time),
    protein: String(recipe.protein),
    carbs: String(recipe.carbs),
    fats: String(recipe.fats),
    calories: String(recipe.calories),
    description: recipe.description,
    instructions: recipe.instructions,
  })
  const [image, setImage] = useState<File | null>(null)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const num = (v: string) => parseFloat(v) || 0

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!f.title.trim()) return
    const data: RecipeInput = {
      title: f.title.trim(),
      category: f.category as RecipeCategory,
      cook_time: num(f.cook_time),
      protein: num(f.protein),
      carbs: num(f.carbs),
      fats: num(f.fats),
      calories: num(f.calories),
      description: f.description,
      instructions: f.instructions,
    }
    const updated = await api.updateRecipe(recipe.id, data, image)
    onSaved(updated)
  }

  return (
    <form onSubmit={save} className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Title" value={f.title} onChange={(v) => set('title', v)} type="text" wide />
        <label className="flex flex-col">
          <span className="mb-1 text-[11px] font-medium text-slate-500">Category</span>
          <select
            value={f.category}
            onChange={(e) => set('category', e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
          <span className="mt-1 text-[10px] text-slate-400">Moves this recipe to that tab.</span>
        </label>
        <Field label="Cook time (min)" value={f.cook_time} onChange={(v) => set('cook_time', v)} />
        <Field label="Calories" value={f.calories} onChange={(v) => set('calories', v)} />
        <Field label="Protein (g)" value={f.protein} onChange={(v) => set('protein', v)} />
        <Field label="Carbs (g)" value={f.carbs} onChange={(v) => set('carbs', v)} />
        <Field label="Fats (g)" value={f.fats} onChange={(v) => set('fats', v)} />
        <label className="flex flex-col">
          <span className="mb-1 text-[11px] font-medium text-slate-500">Replace photo</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="text-xs"
          />
        </label>
      </div>
      <label className="mt-3 flex flex-col">
        <span className="mb-1 text-[11px] font-medium text-slate-500">Description</span>
        <textarea
          value={f.description}
          onChange={(e) => set('description', e.target.value)}
          rows={2}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="mt-3 flex flex-col">
        <span className="mb-1 text-[11px] font-medium text-slate-500">How to make it / prep</span>
        <textarea
          value={f.instructions}
          onChange={(e) => set('instructions', e.target.value)}
          rows={5}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <div className="mt-3 flex gap-2">
        <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Save changes
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'number',
  wide,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  wide?: boolean
}) {
  return (
    <label className={'flex flex-col' + (wide ? ' sm:col-span-2' : '')}>
      <span className="mb-1 text-[11px] font-medium text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
      />
    </label>
  )
}
