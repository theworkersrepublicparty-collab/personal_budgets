import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type RecipeInput } from '../lib/api'
import type { Recipe, RecipeCategory } from '../../shared/types'
import RecipePhotoField from '../components/RecipePhotoField'

const CATEGORIES: { key: RecipeCategory; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { key: 'lunch', label: 'Lunch', emoji: '🥪' },
  { key: 'dinner', label: 'Dinner', emoji: '🍽️' },
  { key: 'snack', label: 'Snacks', emoji: '🍿' },
]

export default function Recipes() {
  const navigate = useNavigate()
  const [active, setActive] = useState<RecipeCategory>('breakfast')
  const [search, setSearch] = useState('')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<'add' | 'import' | null>(null)
  // Select mode + the ids picked. selectedIds is page-level so choices persist
  // as you switch category tabs — then one Delete removes them all at once.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const rows = await api.recipes({ category: active, search: search.trim() || undefined })
    setRecipes(rows)
    setLoading(false)
  }, [active, search])

  useEffect(() => {
    load()
  }, [load])

  const toggle = (p: 'add' | 'import') => setPanel((cur) => (cur === p ? null : p))

  function toggleRecipe(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exitSelect() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  async function deleteSelected() {
    const n = selectedIds.size
    if (!n) return
    if (!confirm(`Delete ${n} selected recipe(s) across all categories? This cannot be undone.`)) return
    await api.bulkDeleteRecipes([...selectedIds])
    exitSelect()
    load()
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">🍽️ Food Recipes</h1>
          <p className="text-sm text-slate-400">Each category keeps its own list — search only looks within the tab you're on.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            className={
              'rounded-lg border px-4 py-2 text-sm font-semibold ' +
              (selectMode
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100')
            }
          >
            {selectMode ? 'Done' : '☑ Select'}
          </button>
          <button
            onClick={() => toggle('import')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            {panel === 'import' ? 'Cancel' : '⬇ Import from Cronometer'}
          </button>
          <button
            onClick={() => toggle('add')}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            {panel === 'add' ? 'Cancel' : '+ Add recipe'}
          </button>
        </div>
      </div>

      {/* Bulk action bar — visible while selecting. Selections persist across tabs. */}
      {selectMode && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm">
          <span className="font-semibold text-indigo-900">
            {selectedIds.size} selected
          </span>
          <span className="text-slate-500">
            Tap cards to pick them — your picks stay as you switch category tabs.
          </span>
          <button
            onClick={deleteSelected}
            disabled={selectedIds.size === 0}
            className="ml-auto rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-money-out hover:bg-red-50 disabled:opacity-40"
          >
            🗑 Delete {selectedIds.size || ''}
          </button>
          <button
            onClick={exitSelect}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-white"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Category tabs — each is a self-contained list */}
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setActive(c.key)}
            className={
              'border-b-2 px-4 py-2 text-sm font-medium transition ' +
              (active === c.key
                ? 'border-ink text-ink'
                : 'border-transparent text-slate-400 hover:text-slate-600')
            }
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <div className="mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${CATEGORIES.find((c) => c.key === active)?.label.toLowerCase()}…`}
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none sm:w-72"
        />
      </div>

      {panel === 'add' && (
        <AddRecipe
          defaultCategory={active}
          onDone={(created) => {
            setPanel(null)
            setActive(created.category)
            load()
          }}
        />
      )}

      {panel === 'import' && (
        <ImportRecipe
          defaultCategory={active}
          onDone={(created) => {
            setPanel(null)
            navigate(`/recipes/${created.id}`)
          }}
        />
      )}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : recipes.length === 0 ? (
        <p className="text-slate-400">
          No {CATEGORIES.find((c) => c.key === active)?.label.toLowerCase()} recipes yet
          {search ? ' matching that search' : ''}.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              selectMode={selectMode}
              selected={selectedIds.has(r.id)}
              onToggle={toggleRecipe}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RecipeCard({
  recipe,
  selectMode,
  selected,
  onToggle,
}: {
  recipe: Recipe
  selectMode: boolean
  selected: boolean
  onToggle: (id: number) => void
}) {
  const emoji = CATEGORIES.find((c) => c.key === recipe.category)?.emoji ?? '🍽️'
  const inner = (
    <>
      <div className="relative flex h-36 items-center justify-center bg-slate-100">
        {recipe.has_image ? (
          <img src={api.recipeImageUrl(recipe.id)} alt={recipe.title} className="h-full w-full object-cover" />
        ) : (
          <span className="text-4xl">{emoji}</span>
        )}
        {selectMode && (
          <span
            className={
              'absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold ' +
              (selected
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-white bg-white/70 text-transparent')
            }
          >
            ✓
          </span>
        )}
      </div>
      <div className="p-4">
        <h2 className="font-semibold">{recipe.title}</h2>
        {recipe.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{recipe.description}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          {recipe.cook_time > 0 && <span>⏱ {recipe.cook_time} min</span>}
          {recipe.calories > 0 && <span>🔥 {recipe.calories} kcal</span>}
        </div>
        <div className="mt-2 flex gap-2 text-[11px]">
          <Macro label="P" value={recipe.protein} color="text-emerald-600" />
          <Macro label="C" value={recipe.carbs} color="text-amber-600" />
          <Macro label="F" value={recipe.fats} color="text-sky-600" />
        </div>
      </div>
    </>
  )

  // In select mode the whole card toggles selection instead of opening it.
  if (selectMode) {
    return (
      <button
        type="button"
        onClick={() => onToggle(recipe.id)}
        className={
          'overflow-hidden rounded-xl border bg-white text-left transition ' +
          (selected
            ? 'border-indigo-500 ring-2 ring-indigo-300'
            : 'border-slate-200 hover:border-slate-300')
        }
      >
        {inner}
      </button>
    )
  }

  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm"
    >
      {inner}
    </Link>
  )
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={`rounded bg-slate-50 px-1.5 py-0.5 font-semibold ${color}`}>
      {label} {value}g
    </span>
  )
}

function AddRecipe({
  defaultCategory,
  onDone,
}: {
  defaultCategory: RecipeCategory
  onDone: (created: Recipe) => void
}) {
  const [f, setF] = useState({
    title: '',
    category: defaultCategory,
    cook_time: '',
    protein: '',
    carbs: '',
    fats: '',
    calories: '',
    description: '',
    instructions: '',
  })
  const [image, setImage] = useState<File | null>(null)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const num = (v: string) => parseFloat(v) || 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.title.trim()) return
    const data: RecipeInput = {
      title: f.title.trim(),
      category: f.category,
      cook_time: num(f.cook_time),
      protein: num(f.protein),
      carbs: num(f.carbs),
      fats: num(f.fats),
      calories: num(f.calories),
      description: f.description,
      instructions: f.instructions,
    }
    const created = await api.createRecipe(data, image)
    onDone(created)
  }

  return (
    <form onSubmit={submit} className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Title" value={f.title} onChange={(v) => set('title', v)} type="text" placeholder="Recipe name" wide />
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
        </label>
        <Field label="Cook time (min)" value={f.cook_time} onChange={(v) => set('cook_time', v)} />
        <Field label="Calories" value={f.calories} onChange={(v) => set('calories', v)} />
        <Field label="Protein (g)" value={f.protein} onChange={(v) => set('protein', v)} />
        <Field label="Carbs (g)" value={f.carbs} onChange={(v) => set('carbs', v)} />
        <Field label="Fats (g)" value={f.fats} onChange={(v) => set('fats', v)} />
      </div>
      <div className="mt-3">
        <RecipePhotoField currentUrl={null} onChange={(c) => setImage(c.file)} />
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
          rows={4}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <div className="mt-3">
        <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Save recipe
        </button>
      </div>
    </form>
  )
}

function ImportRecipe({
  defaultCategory,
  onDone,
}: {
  defaultCategory: RecipeCategory
  onDone: (created: Recipe) => void
}) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<RecipeCategory>(defaultCategory)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !file) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.importCronometerNew(title.trim(), category, file)
      onDone(res.recipe)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">New recipe from a Cronometer file</h3>
        <button
          type="button"
          onClick={() => setShowHelp((s) => !s)}
          className="rounded-full border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
        >
          ℹ︎ How do I get the file?
        </button>
      </div>

      {showHelp && (
        <div className="mb-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <p className="mb-1 font-semibold text-slate-700">Exporting from Cronometer</p>
          <ol className="ml-4 list-decimal space-y-0.5">
            <li>Open <span className="font-medium">cronometer.com</span> in a web browser and log in — the phone app can't export, so use the website (works in your phone's browser too).</li>
            <li>Go to <span className="font-medium">Account → Export Data</span>.</li>
            <li>Choose <span className="font-medium">Servings</span> (per-food rows) or a Daily Nutrition export, pick the day(s) for this meal, and export.</li>
            <li>A <span className="font-medium">.csv</span> file downloads. Pick it below.</li>
          </ol>
          <p className="mt-1 text-[11px] text-slate-400">
            The importer adds up the Protein / Carbs / Fat / Calories columns across every row. Not tested against a real
            export yet — if the numbers look off, send me the file and I'll adjust.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col sm:col-span-2">
          <span className="mb-1 text-[11px] font-medium text-slate-500">Recipe name</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Chicken & rice bowl"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
          />
        </label>
        <label className="flex flex-col">
          <span className="mb-1 text-[11px] font-medium text-slate-500">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as RecipeCategory)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="mb-1 text-[11px] font-medium text-slate-500">Cronometer file</span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-xs"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          disabled={busy || !title.trim() || !file}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Importing…' : 'Import & create recipe'}
        </button>
        <span className="text-xs text-slate-400">Macros fill in from the file; add photo &amp; steps after.</span>
      </div>
      {error && <p className="mt-2 text-xs text-money-out">{error}</p>}
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'number',
  placeholder,
  wide,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  wide?: boolean
}) {
  return (
    <label className={'flex flex-col' + (wide ? ' sm:col-span-2' : '')}>
      <span className="mb-1 text-[11px] font-medium text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
      />
    </label>
  )
}
