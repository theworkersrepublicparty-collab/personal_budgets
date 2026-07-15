import type {
  Budget,
  BudgetConfig,
  BudgetType,
  ColumnMapping,
  EntryKind,
  ImportResult,
  Kpis,
  Lease,
  ParsePreview,
  PlannerItem,
  PlannerKind,
  Property,
  PropertyConfig,
  PropertyEntry,
  Recipe,
  RecipeCategory,
  Transaction,
  TxnFilters,
  WorkoutDoc,
} from '../../shared/types'

export interface EntryInput {
  entry_date: string
  kind: EntryKind
  category: string
  amount: number
  note?: string | null
  paid?: number
}

export interface LeaseInput {
  tenant: string
  start_month: string
  end_month: string
  monthly_rent: number
  note?: string | null
  deposit?: number // security deposit collected at move-in
  prepaid?: number // first/last month's rent or other upfront money
}

// Fields you can set when creating or editing a transaction by hand.
export interface TxnInput {
  txn_date: string
  description: string
  amount: number // signed: + = money in, - = money out
  category?: string | null
  section?: string | null
  source?: string | null // account label, e.g. "Chase Card"
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

function qs(filters: TxnFilters): string {
  const p = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v) p.set(k, String(v))
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

export interface ParseResponse extends ParsePreview {
  suggestedMapping: ColumnMapping
}

export const api = {
  listBudgets: () => fetch('/api/budgets').then(json<Budget[]>),

  getBudget: (id: number) => fetch(`/api/budgets/${id}`).then(json<Budget>),

  createBudget: (name: string, type: BudgetType) =>
    fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type }),
    }).then(json<Budget>),

  updateBudget: (id: number, patch: { name?: string; config?: Partial<BudgetConfig> }) =>
    fetch(`/api/budgets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(json<Budget>),

  deleteBudget: (id: number) =>
    fetch(`/api/budgets/${id}`, { method: 'DELETE' }).then(json<{ ok: boolean }>),

  parse: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return fetch('/api/parse', { method: 'POST', body: fd }).then(json<ParseResponse>)
  },

  import: (id: number, file: File, mapping: ColumnMapping, source?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mapping', JSON.stringify(mapping))
    if (source) fd.append('source', source)
    return fetch(`/api/budgets/${id}/import`, { method: 'POST', body: fd }).then(json<ImportResult>)
  },

  transactions: (id: number, filters: TxnFilters = {}) =>
    fetch(`/api/budgets/${id}/transactions${qs(filters)}`).then(json<Transaction[]>),

  createTxn: (id: number, data: TxnInput) =>
    fetch(`/api/budgets/${id}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(json<Transaction>),

  updateTxn: (id: number, txnId: number, data: Partial<TxnInput>) =>
    fetch(`/api/budgets/${id}/transactions/${txnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(json<Transaction>),

  deleteTxn: (id: number, txnId: number) =>
    fetch(`/api/budgets/${id}/transactions/${txnId}`, { method: 'DELETE' }).then(
      json<{ ok: boolean }>,
    ),

  bulkCategory: (id: number, ids: number[], category: string | null) =>
    fetch(`/api/budgets/${id}/transactions/bulk-category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, category }),
    }).then(json<{ updated: number }>),

  bulkDelete: (id: number, ids: number[]) =>
    fetch(`/api/budgets/${id}/transactions/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).then(json<{ deleted: number }>),

  autoCategorize: (id: number, overwrite = false) =>
    fetch(`/api/budgets/${id}/autocategorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overwrite }),
    }).then(json<{ updated: number; ruleCount: number }>),

  clearTransactions: (id: number) =>
    fetch(`/api/budgets/${id}/transactions`, { method: 'DELETE' }).then(json<{ ok: boolean }>),

  kpis: (id: number, filters: TxnFilters = {}) =>
    fetch(`/api/budgets/${id}/kpis${qs(filters)}`).then(json<Kpis>),

  // Earliest / latest transaction dates for this budget (ignores filters).
  dateRange: (id: number) =>
    fetch(`/api/budgets/${id}/date-range`).then(
      json<{ min: string | null; max: string | null; count: number }>,
    ),

  // --- Backup / Restore ---
  // A direct download URL for the selected tabs (used by an <a download>).
  exportUrl: (groups: string[]) =>
    `/api/export${groups.length ? `?groups=${encodeURIComponent(groups.join(','))}` : ''}`,

  importBackup: (file: File, groups: string[]) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('groups', groups.join(','))
    return fetch('/api/import-backup', { method: 'POST', body: fd }).then(
      json<{ ok: boolean; restored: Record<string, number> }>,
    )
  },

  // --- Budget Planner ---
  planner: () => fetch('/api/planner').then(json<PlannerItem[]>),

  createPlannerItem: (kind: PlannerKind) =>
    fetch('/api/planner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    }).then(json<PlannerItem>),

  updatePlannerItem: (
    id: number,
    data: Partial<{ name: string; monthly: number; note: string | null }>,
  ) =>
    fetch(`/api/planner/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(json<PlannerItem>),

  deletePlannerItem: (id: number) =>
    fetch(`/api/planner/${id}`, { method: 'DELETE' }).then(json<{ ok: boolean }>),

  // --- Rental properties ---
  properties: () => fetch('/api/properties').then(json<Property[]>),

  getProperty: (id: number) => fetch(`/api/properties/${id}`).then(json<Property>),

  createProperty: (name: string, address: string, config: PropertyConfig) =>
    fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, address, config }),
    }).then(json<Property>),

  updateProperty: (
    id: number,
    patch: { name?: string; address?: string; config?: Partial<PropertyConfig> },
  ) =>
    fetch(`/api/properties/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(json<Property>),

  deleteProperty: (id: number) =>
    fetch(`/api/properties/${id}`, { method: 'DELETE' }).then(json<{ ok: boolean }>),

  entries: (id: number) => fetch(`/api/properties/${id}/entries`).then(json<PropertyEntry[]>),

  createEntry: (id: number, data: EntryInput) =>
    fetch(`/api/properties/${id}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(json<PropertyEntry>),

  updateEntry: (id: number, eid: number, data: Partial<EntryInput>) =>
    fetch(`/api/properties/${id}/entries/${eid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(json<PropertyEntry>),

  deleteEntry: (id: number, eid: number) =>
    fetch(`/api/properties/${id}/entries/${eid}`, { method: 'DELETE' }).then(json<{ ok: boolean }>),

  leases: (id: number) => fetch(`/api/properties/${id}/leases`).then(json<Lease[]>),

  createLease: (id: number, data: LeaseInput) =>
    fetch(`/api/properties/${id}/leases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(json<{ lease: Lease; generated: number }>),

  deleteLease: (id: number, lid: number) =>
    fetch(`/api/properties/${id}/leases/${lid}`, { method: 'DELETE' }).then(json<{ ok: boolean }>),

  bulkDeleteEntries: (id: number, ids: number[]) =>
    fetch(`/api/properties/${id}/entries/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).then(json<{ deleted: number }>),

  propertyCategories: () => fetch('/api/property-categories').then(json<string[]>),

  savePropertyCategories: (categories: string[]) =>
    fetch('/api/property-categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories }),
    }).then(json<string[]>),

  // --- Food Recipes ---
  recipes: (filters: { category?: RecipeCategory; search?: string } = {}) => {
    const p = new URLSearchParams()
    if (filters.category) p.set('category', filters.category)
    if (filters.search) p.set('search', filters.search)
    const s = p.toString()
    return fetch(`/api/recipes${s ? `?${s}` : ''}`).then(json<Recipe[]>)
  },

  getRecipe: (id: number) => fetch(`/api/recipes/${id}`).then(json<Recipe>),

  // Pass a `version` (e.g. a timestamp) after saving a new photo so the URL
  // changes and the browser fetches the fresh image instead of a cached one.
  recipeImageUrl: (id: number, version?: number) =>
    `/api/recipes/${id}/image${version ? `?v=${version}` : ''}`,

  createRecipe: (data: RecipeInput, image?: File | null) => {
    const fd = recipeFormData(data, image)
    return fetch('/api/recipes', { method: 'POST', body: fd }).then(json<Recipe>)
  },

  updateRecipe: (
    id: number,
    data: Partial<RecipeInput>,
    image?: File | null,
    removeImage = false,
  ) => {
    const fd = recipeFormData(data, image)
    if (removeImage && !image) fd.append('remove_image', '1')
    return fetch(`/api/recipes/${id}`, { method: 'PATCH', body: fd }).then(json<Recipe>)
  },

  deleteRecipe: (id: number) =>
    fetch(`/api/recipes/${id}`, { method: 'DELETE' }).then(json<{ ok: boolean }>),

  bulkDeleteRecipes: (ids: number[]) =>
    fetch('/api/recipes/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).then(json<{ deleted: number }>),

  importCronometer: (id: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return fetch(`/api/recipes/${id}/import-cronometer`, { method: 'POST', body: fd }).then(
      json<{ recipe: Recipe; rowsRead: number; protein: number; carbs: number; fats: number; calories: number }>,
    )
  },

  // Create a brand-new recipe from a Cronometer file (title + category supplied by the user).
  importCronometerNew: (title: string, category: RecipeCategory, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', title)
    fd.append('category', category)
    return fetch('/api/recipes/import-cronometer', { method: 'POST', body: fd }).then(
      json<{ recipe: Recipe; rowsRead: number; protein: number; carbs: number; fats: number; calories: number }>,
    )
  },

  // --- Workouts ---
  // The entire workout tab is one JSON document; fetch it, then PUT the whole
  // thing back on change (the page debounces saves).
  getWorkout: () => fetch('/api/workout').then(json<WorkoutDoc>),

  saveWorkout: (doc: WorkoutDoc) =>
    fetch('/api/workout', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    }).then(json<{ ok: true }>),
}

export interface RecipeInput {
  title: string
  category: RecipeCategory
  cook_time: number
  protein: number
  carbs: number
  fats: number
  calories: number
  instructions: string
  description: string
}

function recipeFormData(data: Partial<RecipeInput>, image?: File | null): FormData {
  const fd = new FormData()
  Object.entries(data).forEach(([k, v]) => {
    if (v !== undefined) fd.append(k, String(v))
  })
  if (image) fd.append('image', image)
  return fd
}
