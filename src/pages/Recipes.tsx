import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type RecipeInput } from '../lib/api'
import type { Recipe, RecipeCategory } from '../../shared/types'

const CATEGORIES: { key: RecipeCategory; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { key: 'lunch', label: 'Lunch', emoji: '🥪' },
  { key: 'dinner', label: 'Dinner', emoji: '🍽️' },
  { key: 'snack', label: 'Snacks', emoji: '🍿' },
]

export default function Recipes() {
  const [active, setActive] = useState<RecipeCategory>('breakfast')
  const [search, setSearch] = useState('')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const rows = await api.recipes({ category: active, search: search.trim() || undefined })
    setRecipes(rows)
    setLoading(false)
  }, [active, search])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🍽️ Food Recipes</h1>
          <p className="text-sm text-slate-400">Each category keeps its own list — search only looks within the tab you're on.</p>
        </div>
        <button
          onClick={() => setAdding((a) => !a)}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          {adding ? 'Cancel' : '+ Add recipe'}
        </button>
      </div>

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

      {adding && (
        <AddRecipe
          defaultCategory={active}
          onDone={(created) => {
            setAdding(false)
            setActive(created.category)
            load()
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
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const emoji = CATEGORIES.find((c) => c.key === recipe.category)?.emoji ?? '🍽️'
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex h-36 items-center justify-center bg-slate-100">
        {recipe.has_image ? (
          <img src={api.recipeImageUrl(recipe.id)} alt={recipe.title} className="h-full w-full object-cover" />
        ) : (
          <span className="text-4xl">{emoji}</span>
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
        <label className="flex flex-col">
          <span className="mb-1 text-[11px] font-medium text-slate-500">Photo</span>
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
