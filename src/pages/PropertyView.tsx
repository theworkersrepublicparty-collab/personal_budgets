import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { FixedCost, Lease, Property, PropertyEntry } from '../../shared/types'
import { computePropertyStats } from '../lib/property'
import { CashFlowChart, ExpensePie } from '../components/PropertyCharts'
import MetricGlossary from '../components/MetricGlossary'
import { money } from '../lib/format'

export default function PropertyView() {
  const { id } = useParams()
  const propertyId = Number(id)
  const [property, setProperty] = useState<Property | null>(null)
  const [entries, setEntries] = useState<PropertyEntry[]>([])
  const [leases, setLeases] = useState<Lease[]>([])
  const [masterCats, setMasterCats] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [editingDetails, setEditingDetails] = useState(false)
  const [fixedOpen, setFixedOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    const [p, e, l, c] = await Promise.all([
      api.getProperty(propertyId),
      api.entries(propertyId),
      api.leases(propertyId),
      api.propertyCategories(),
    ])
    setProperty(p)
    setEntries(e)
    setLeases(l)
    setMasterCats(c)
    setSelectedIds(new Set())
    setLoading(false)
  }, [propertyId])
  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="text-slate-400">Loading…</p>
  if (!property) return <p className="text-slate-400">Property not found.</p>

  const stats = computePropertyStats(entries, property.config)

  function setLocal(eid: number, patch: Partial<PropertyEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === eid ? { ...e, ...patch } : e)))
  }
  function saveEntry(eid: number, patch: Partial<PropertyEntry>) {
    api.updateEntry(propertyId, eid, patch as never)
  }
  async function addEntry(kind: 'income' | 'expense') {
    const today = new Date().toISOString().slice(0, 10)
    await api.createEntry(propertyId, { entry_date: today, kind, category: '', amount: 0, note: '' })
    load()
  }
  async function removeEntry(eid: number) {
    await api.deleteEntry(propertyId, eid)
    load()
  }
  function togglePaid(e: PropertyEntry) {
    const paid = e.paid ? 0 : 1
    setLocal(e.id, { paid })
    api.updateEntry(propertyId, e.id, { paid } as never)
  }
  async function removeLease(lid: number) {
    if (!confirm('Delete this lease and its generated rent rows?')) return
    await api.deleteLease(propertyId, lid)
    load()
  }
  async function saveFixedCosts(fixedCosts: FixedCost[]) {
    await api.updateProperty(propertyId, { config: { fixedCosts } })
    load()
  }
  function toggleSel(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleSelAll(select: boolean) {
    setSelectedIds(select ? new Set(entries.map((e) => e.id)) : new Set())
  }
  async function deleteSelected() {
    if (!confirm(`Delete ${selectedIds.size} selected entr${selectedIds.size === 1 ? 'y' : 'ies'}?`)) return
    await api.bulkDeleteEntries(propertyId, [...selectedIds])
    load()
  }

  return (
    <div>
      <div className="mb-1">
        <Link to="/properties" className="text-sm text-slate-400 hover:text-ink">
          ← All properties
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{property.name}</h1>
          {property.address && <p className="text-sm text-slate-400">{property.address}</p>}
        </div>
        <button
          onClick={() => setEditingDetails((v) => !v)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          {editingDetails ? 'Done' : '✎ Purchase details'}
        </button>
      </div>

      {editingDetails && <PurchaseDetails property={property} onSaved={load} />}

      {/* Fixed monthly costs — collapsible, auto-included every month */}
      <FixedCostsPanel
        open={fixedOpen}
        onToggle={() => setFixedOpen((o) => !o)}
        fixedCosts={property.config.fixedCosts ?? []}
        monthlyTotal={stats.fixedMonthly}
        onSave={saveFixedCosts}
      />

      {/* Headline metrics */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Monthly cash flow" value={money(stats.avgMonthlyCashFlow)} sub={`${money(stats.annualCashFlow)} / yr`} tone={stats.avgMonthlyCashFlow >= 0 ? 'in' : 'out'} big />
        <Metric label="Cash-on-cash" value={pct(stats.cashOnCash)} sub={`on ${money(stats.cashInvested)} invested`} tone={stats.cashOnCash >= 8 ? 'in' : stats.cashOnCash >= 0 ? 'warn' : 'out'} />
        <Metric label="Cap rate" value={pct(stats.capRate)} sub={`NOI ${money(stats.annualNOI)}/yr`} />
        <Metric label="Net (all time)" value={money(stats.net)} sub={`${stats.monthsTracked} mo tracked`} tone={stats.net >= 0 ? 'in' : 'out'} />
      </div>

      {/* Secondary metrics */}
      <div className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Mini label="Total income (collected)" value={money(stats.totalIncome)} tone="in" />
        <Mini label="Total expenses" value={money(stats.totalExpenses)} tone="out" />
        <Mini label="Unpaid rent (scheduled)" value={money(stats.unpaidIncome)} tone={stats.unpaidIncome > 0 ? 'out' : undefined} />
        <Mini label="Deposits held (refundable)" value={money(stats.depositsHeld)} />
        <Mini label="Fixed costs / mo" value={money(stats.fixedMonthly)} />
        <Mini label="1% rule" value={pct(stats.onePctRule)} hint={stats.onePctRule >= 1 ? '✓' : 'low'} good={stats.onePctRule >= 1} />
        <Mini label="50% rule" value={pct(stats.fiftyPctRule)} hint={stats.fiftyPctRule <= 50 ? '✓' : 'high'} good={stats.fiftyPctRule <= 50} />
      </div>

      {/* Leases / contracts */}
      <LeaseSection leases={leases} propertyId={propertyId} onChanged={load} onDelete={removeLease} />


      {/* Charts */}
      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <CashFlowChart stats={stats} />
        <ExpensePie stats={stats} />
      </div>

      {/* Ledger */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-600">Ledger ({entries.length})</h3>
        <div className="flex gap-2">
          <button onClick={() => addEntry('income')} className="rounded-lg border border-green-200 bg-white px-3 py-1.5 text-sm font-medium text-money-in hover:bg-green-50">
            ＋ Income
          </button>
          <button onClick={() => addEntry('expense')} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-money-out hover:bg-red-50">
            ＋ Expense
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
          <span className="font-semibold text-money-out">{selectedIds.size} selected</span>
          <button onClick={deleteSelected} className="rounded-lg bg-money-out px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90" style={{ backgroundColor: '#dc2626' }}>
            🗑 Delete {selectedIds.size}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-white">
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={entries.length > 0 && entries.every((e) => selectedIds.has(e.id))}
                  onChange={(ev) => toggleSelAll(ev.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-ink"
                />
              </th>
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Category</th>
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
              <th className="px-3 py-2 text-center font-semibold">Paid</th>
              <th className="px-3 py-2 font-semibold">Note</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {/* Recurring fixed costs — auto-included every month, edit them in the panel above */}
            {(property.config.fixedCosts ?? []).map((fc, i) => (
              <tr key={`fixed-${i}`} className="border-b border-slate-100 bg-amber-50/40">
                <td className="px-3 py-1.5"></td>
                <td className="px-3 py-1.5 text-xs italic text-slate-400">monthly</td>
                <td className="px-3 py-1.5 text-money-out">Expense</td>
                <td className="px-3 py-1.5">{fc.category || 'Fixed cost'}</td>
                <td className="px-3 py-1.5 text-right text-money-out">{money(fc.amount)}</td>
                <td className="px-3 py-1.5 text-center text-[10px] uppercase text-amber-600">auto</td>
                <td className="px-3 py-1.5 text-xs text-slate-400">fixed cost</td>
                <td className="px-3 py-1.5"></td>
              </tr>
            ))}
            {entries.length === 0 && (property.config.fixedCosts ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                  No entries yet. Use “＋ Income” or “＋ Expense” to start logging.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className={'border-b border-slate-100 last:border-0 ' + (e.paid === 0 ? 'bg-slate-50/60 italic text-slate-400' : (selectedIds.has(e.id) ? 'bg-indigo-50' : ''))}>
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    aria-label="Select entry"
                    checked={selectedIds.has(e.id)}
                    onChange={() => toggleSel(e.id)}
                    className="h-4 w-4 cursor-pointer accent-ink"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="date"
                    value={e.entry_date}
                    onChange={(ev) => setLocal(e.id, { entry_date: ev.target.value })}
                    onBlur={(ev) => saveEntry(e.id, { entry_date: ev.target.value })}
                    className="rounded border border-transparent px-1 py-1 hover:border-slate-200 focus:border-slate-300 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <select
                    value={e.kind}
                    onChange={(ev) => { const kind = ev.target.value as 'income' | 'expense'; setLocal(e.id, { kind }); saveEntry(e.id, { kind }) }}
                    className={'rounded border border-transparent px-1 py-1 hover:border-slate-200 focus:outline-none ' + (e.kind === 'income' ? 'text-money-in' : 'text-money-out')}
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input
                    list="cats-master"
                    value={e.category}
                    placeholder="category…"
                    onChange={(ev) => setLocal(e.id, { category: ev.target.value })}
                    onBlur={(ev) => saveEntry(e.id, { category: ev.target.value })}
                    className="w-40 rounded border border-transparent px-1 py-1 hover:border-slate-200 focus:border-slate-300 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={e.amount === 0 ? '' : e.amount}
                    placeholder="0.00"
                    onChange={(ev) => setLocal(e.id, { amount: parseFloat(ev.target.value) || 0 })}
                    onBlur={(ev) => saveEntry(e.id, { amount: parseFloat(ev.target.value) || 0 })}
                    className={'w-24 rounded border border-transparent px-1 py-1 text-right hover:border-slate-200 focus:border-slate-300 focus:outline-none ' + (e.kind === 'income' ? 'text-money-in' : 'text-money-out')}
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={e.paid !== 0}
                    onChange={() => togglePaid(e)}
                    title={e.paid ? 'Paid / collected' : 'Not yet paid'}
                    className="h-4 w-4 cursor-pointer accent-ink"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    value={e.note ?? ''}
                    placeholder="—"
                    onChange={(ev) => setLocal(e.id, { note: ev.target.value })}
                    onBlur={(ev) => saveEntry(e.id, { note: ev.target.value || null })}
                    className="w-full rounded border border-transparent px-1 py-1 text-slate-500 hover:border-slate-200 focus:border-slate-300 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button onClick={() => removeEntry(e.id)} aria-label="Delete entry" className="rounded px-1.5 py-1 text-xs text-slate-300 hover:bg-red-50 hover:text-money-out">
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <datalist id="cats-master">
        {masterCats.map((c) => <option key={c} value={c} />)}
      </datalist>

      <div className="mt-5">
        <MetricGlossary />
      </div>
    </div>
  )
}

function PurchaseDetails({ property, onSaved }: { property: Property; onSaved: () => void }) {
  const c = property.config
  const [f, setF] = useState({
    name: property.name,
    address: property.address,
    purchasePrice: String(c.purchasePrice ?? ''),
    downPayment: String(c.downPayment ?? ''),
    closingCosts: String(c.closingCosts ?? ''),
    rehab: String(c.rehab ?? ''),
    rate: String(c.rate ?? ''),
    termYears: String(c.termYears ?? ''),
  })
  const [paidOff, setPaidOff] = useState(!!c.paidOff)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const num = (v: string) => parseFloat(v) || 0

  async function save() {
    await api.updateProperty(property.id, {
      name: f.name.trim() || property.name,
      address: f.address,
      config: {
        purchasePrice: num(f.purchasePrice),
        downPayment: num(f.downPayment),
        closingCosts: num(f.closingCosts),
        rehab: num(f.rehab),
        rate: num(f.rate),
        termYears: num(f.termYears),
        paidOff,
      },
    })
    onSaved()
  }

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['name', 'Name', 'text', ''],
          ['address', 'Address', 'text', ''],
          ['purchasePrice', 'Purchase price', 'number', '$'],
          ['downPayment', 'Down payment', 'number', '$'],
          ['closingCosts', 'Closing costs', 'number', '$'],
          ['rehab', 'Rehab', 'number', '$'],
          ['rate', 'Interest rate', 'number', '%'],
          ['termYears', 'Loan term (yrs)', 'number', ''],
        ].map(([key, label, type, mark]) => (
          <label key={key} className="flex flex-col">
            <span className="mb-1 text-[11px] font-medium text-slate-500">{label}</span>
            <div className="flex items-center rounded-lg border border-slate-300 px-2 focus-within:border-slate-400">
              {mark === '$' && <span className="text-sm text-slate-400">$</span>}
              <input
                type={type}
                value={(f as Record<string, string>)[key]}
                onChange={(e) => set(key, e.target.value)}
                className="w-full bg-transparent px-1 py-1.5 text-sm outline-none"
              />
              {mark === '%' && <span className="text-sm text-slate-400">%</span>}
            </div>
          </label>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={paidOff} onChange={(e) => setPaidOff(e.target.checked)} className="h-4 w-4 accent-ink" />
        Owned free &amp; clear (no mortgage) — paid off
      </label>
      {paidOff && (
        <p className="mt-1 text-xs text-slate-400">
          Cash-on-cash will use the full {money(num(f.purchasePrice) + num(f.closingCosts) + num(f.rehab))} you have
          tied up. Just don't log any mortgage entries in the ledger.
        </p>
      )}
      <div>
        <button onClick={save} className="mt-3 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Save details
        </button>
      </div>
    </div>
  )
}

function FixedCostsPanel({
  open,
  onToggle,
  fixedCosts,
  monthlyTotal,
  onSave,
}: {
  open: boolean
  onToggle: () => void
  fixedCosts: FixedCost[]
  monthlyTotal: number
  onSave: (next: FixedCost[]) => Promise<void>
}) {
  const [list, setList] = useState(fixedCosts.map((fc) => ({ category: fc.category, amount: String(fc.amount) })))
  const [saving, setSaving] = useState(false)

  // Re-sync when the property reloads.
  useEffect(() => {
    setList(fixedCosts.map((fc) => ({ category: fc.category, amount: String(fc.amount) })))
  }, [fixedCosts])

  function update(i: number, patch: Partial<{ category: string; amount: string }>) {
    setList(list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  async function save() {
    setSaving(true)
    await onSave(list.map((r) => ({ category: r.category.trim() || 'Fixed cost', amount: parseFloat(r.amount) || 0 })))
    setSaving(false)
  }

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
        <span className="text-sm font-semibold text-slate-700">🔁 Fixed monthly costs</span>
        <span className="text-xs font-medium text-slate-400">
          {money(monthlyTotal)}/mo · {open ? 'Hide ▲' : 'Show ▼'}
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100 p-4">
          <p className="mb-3 text-xs text-slate-400">
            Recurring costs (mortgage, taxes, insurance, HOA…). These are auto-included in every
            tracked month's totals and shown as “auto” rows in the ledger below.
          </p>
          <div className="grid gap-2">
            {list.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  list="cats-master"
                  value={r.category}
                  placeholder="e.g. Insurance"
                  onChange={(e) => update(i, { category: e.target.value })}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
                <div className="flex items-center rounded-lg border border-slate-300 px-2">
                  <span className="text-sm text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={r.amount}
                    placeholder="0.00"
                    onChange={(e) => update(i, { amount: e.target.value })}
                    className="w-24 bg-transparent px-1 py-1.5 text-sm outline-none"
                  />
                  <span className="text-xs text-slate-400">/mo</span>
                </div>
                <button onClick={() => setList(list.filter((_, idx) => idx !== i))} aria-label="Remove" className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={() => setList([...list, { category: '', amount: '' }])} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
              ＋ Add fixed cost
            </button>
            <button onClick={save} disabled={saving} className="ml-auto rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save fixed costs'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function LeaseSection({
  leases,
  propertyId,
  onChanged,
  onDelete,
}: {
  leases: Lease[]
  propertyId: number
  onChanged: () => void
  onDelete: (lid: number) => void
}) {
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ tenant: '', start_month: '', end_month: '', monthly_rent: '', deposit: '', prepaid: '' })
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  const [editingId, setEditingId] = useState<number | null>(null)
  const [ef, setEf] = useState({ tenant: '', start_month: '', end_month: '', monthly_rent: '' })
  const setE = (k: string, v: string) => setEf((p) => ({ ...p, [k]: v }))

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!f.start_month || !f.end_month) return
    const res = await api.createLease(propertyId, {
      tenant: f.tenant.trim(),
      start_month: f.start_month,
      end_month: f.end_month,
      monthly_rent: parseFloat(f.monthly_rent) || 0,
      deposit: parseFloat(f.deposit) || 0,
      prepaid: parseFloat(f.prepaid) || 0,
    })
    setF({ tenant: '', start_month: '', end_month: '', monthly_rent: '', deposit: '', prepaid: '' })
    setAdding(false)
    alert(`Lease created — generated ${res.generated} rows (rent + any deposit/upfront), unpaid until you check them off.`)
    onChanged()
  }

  function startEdit(l: Lease) {
    setEditingId(l.id)
    setEf({ tenant: l.tenant ?? '', start_month: l.start_month, end_month: l.end_month, monthly_rent: String(l.monthly_rent) })
  }

  async function saveEdit(e: React.FormEvent, lid: number) {
    e.preventDefault()
    if (!ef.start_month || !ef.end_month) return
    await api.updateLease(propertyId, lid, {
      tenant: ef.tenant.trim(),
      start_month: ef.start_month,
      end_month: ef.end_month,
      monthly_rent: parseFloat(ef.monthly_rent) || 0,
    })
    setEditingId(null)
    onChanged()
  }

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-600">Leases / contracts</h3>
        <button onClick={() => setAdding((a) => !a)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          {adding ? 'Cancel' : '＋ New lease'}
        </button>
      </div>

      {adding && (
        <form onSubmit={create} className="mb-3 grid items-end gap-3 sm:grid-cols-5">
          <label className="flex flex-col">
            <span className="mb-1 text-[11px] font-medium text-slate-500">Tenant (optional)</span>
            <input value={f.tenant} onChange={(e) => set('tenant', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col">
            <span className="mb-1 text-[11px] font-medium text-slate-500">From month</span>
            <input type="month" value={f.start_month} onChange={(e) => set('start_month', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col">
            <span className="mb-1 text-[11px] font-medium text-slate-500">To month</span>
            <input type="month" value={f.end_month} onChange={(e) => set('end_month', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col">
            <span className="mb-1 text-[11px] font-medium text-slate-500">Rent / month</span>
            <div className="flex items-center rounded-lg border border-slate-300 px-2">
              <span className="text-sm text-slate-400">$</span>
              <input type="number" step="0.01" value={f.monthly_rent} onChange={(e) => set('monthly_rent', e.target.value)} className="w-full bg-transparent px-1 py-1.5 text-sm outline-none" />
            </div>
          </label>
          <label className="flex flex-col">
            <span className="mb-1 text-[11px] font-medium text-slate-500">Security deposit</span>
            <div className="flex items-center rounded-lg border border-slate-300 px-2">
              <span className="text-sm text-slate-400">$</span>
              <input type="number" step="0.01" value={f.deposit} onChange={(e) => set('deposit', e.target.value)} className="w-full bg-transparent px-1 py-1.5 text-sm outline-none" />
            </div>
          </label>
          <label className="flex flex-col">
            <span className="mb-1 text-[11px] font-medium text-slate-500">First/last & fees (upfront)</span>
            <div className="flex items-center rounded-lg border border-slate-300 px-2">
              <span className="text-sm text-slate-400">$</span>
              <input type="number" step="0.01" value={f.prepaid} onChange={(e) => set('prepaid', e.target.value)} className="w-full bg-transparent px-1 py-1.5 text-sm outline-none" />
            </div>
          </label>
          <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Generate rent + move-in</button>
        </form>
      )}

      {leases.length === 0 ? (
        <p className="text-sm text-slate-400">No leases yet. Add one to auto-generate monthly rent rows.</p>
      ) : (
        <div className="space-y-1">
          {leases.map((l) =>
            editingId === l.id ? (
              <form
                key={l.id}
                onSubmit={(e) => saveEdit(e, l.id)}
                className="grid items-end gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-5"
              >
                <label className="flex flex-col">
                  <span className="mb-1 text-[11px] font-medium text-slate-500">Tenant (optional)</span>
                  <input value={ef.tenant} onChange={(e) => setE('tenant', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                </label>
                <label className="flex flex-col">
                  <span className="mb-1 text-[11px] font-medium text-slate-500">From month</span>
                  <input type="month" value={ef.start_month} onChange={(e) => setE('start_month', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                </label>
                <label className="flex flex-col">
                  <span className="mb-1 text-[11px] font-medium text-slate-500">To month</span>
                  <input type="month" value={ef.end_month} onChange={(e) => setE('end_month', e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                </label>
                <label className="flex flex-col">
                  <span className="mb-1 text-[11px] font-medium text-slate-500">Rent / month</span>
                  <div className="flex items-center rounded-lg border border-slate-300 px-2">
                    <span className="text-sm text-slate-400">$</span>
                    <input type="number" step="0.01" value={ef.monthly_rent} onChange={(e) => setE('monthly_rent', e.target.value)} className="w-full bg-transparent px-1 py-1.5 text-sm outline-none" />
                  </div>
                </label>
                <div className="flex gap-2">
                  <button className="rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
                </div>
                <p className="text-xs text-slate-400 sm:col-span-5">
                  Only unpaid rent rows are added, re-priced, or removed to match the new terms — paid rows are left alone.
                </p>
              </form>
            ) : (
              <div key={l.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>
                  <b>{money(l.monthly_rent)}/mo</b> · {l.start_month} → {l.end_month}
                  {l.tenant && <span className="text-slate-500"> · {l.tenant}</span>}
                </span>
                <span className="flex gap-3">
                  <button onClick={() => startEdit(l)} className="text-xs text-slate-400 hover:text-ink">Edit</button>
                  <button onClick={() => onDelete(l.id)} className="text-xs text-slate-400 hover:text-money-out">Delete</button>
                </span>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, sub, tone, big }: { label: string; value: string; sub?: string; tone?: 'in' | 'out' | 'warn'; big?: boolean }) {
  const color = tone === 'in' ? 'text-money-in' : tone === 'out' ? 'text-money-out' : tone === 'warn' ? 'text-amber-500' : 'text-ink'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 font-bold ${big ? 'text-2xl' : 'text-xl'} ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}

function Mini({ label, value, tone, hint, good }: { label: string; value: string; tone?: 'in' | 'out'; hint?: string; good?: boolean }) {
  const color = tone === 'in' ? 'text-money-in' : tone === 'out' ? 'text-money-out' : 'text-ink'
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={'mt-0.5 font-bold ' + color}>
        {value}
        {hint && <span className={'ml-2 text-xs font-normal ' + (good ? 'text-money-in' : 'text-money-out')}>{hint}</span>}
      </div>
    </div>
  )
}

function pct(v: number): string {
  return `${v.toFixed(1)}%`
}
