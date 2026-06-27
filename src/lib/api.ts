import type {
  Budget,
  BudgetConfig,
  BudgetType,
  ColumnMapping,
  ImportResult,
  Kpis,
  ParsePreview,
  Transaction,
  TxnFilters,
} from '../../shared/types'

// Fields you can set when creating or editing a transaction by hand.
export interface TxnInput {
  txn_date: string
  description: string
  amount: number // signed: + = money in, - = money out
  category?: string | null
  section?: string | null
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

  import: (id: number, file: File, mapping: ColumnMapping) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mapping', JSON.stringify(mapping))
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
}
