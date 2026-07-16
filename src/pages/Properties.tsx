import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Property } from '../../shared/types'
import { aggregatePortfolio, computePropertyStats, type PropertyStats } from '../lib/property'
import { money } from '../lib/format'
import CategoryManager from '../components/CategoryManager'

export default function Properties() {
  const [rows, setRows] = useState<{ property: Property; stats: PropertyStats }[]>([])
  const [masterCats, setMasterCats] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [managingCats, setManagingCats] = useState(false)

  async function load() {
    const [props, cats] = await Promise.all([api.properties(), api.propertyCategories()])
    setMasterCats(cats)
    const withStats = await Promise.all(
      props.map(async (property) => ({
        property,
        stats: computePropertyStats(await api.entries(property.id), property.config),
      })),
    )
    setRows(withStats)
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  async function saveCategories(next: string[]) {
    await api.savePropertyCategories(next)
    setManagingCats(false)
    load()
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Delete "${name}" and all its ledger entries, fixed costs, and leases? This cannot be undone.`)) return
    await api.deleteProperty(id)
    load()
  }

  const portfolio = aggregatePortfolio(rows)

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🏠 Properties</h1>
          <p className="text-sm text-slate-400">Track real income & expenses for each rental you manage.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setManagingCats(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            🏷 Categories
          </button>
          <button
            onClick={() => setCreating((c) => !c)}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            {creating ? 'Cancel' : '+ Add property'}
          </button>
        </div>
      </div>

      {managingCats && (
        <CategoryManager
          categories={masterCats}
          onCancel={() => setManagingCats(false)}
          onSave={saveCategories}
        />
      )}

      {creating && <AddProperty onDone={() => { setCreating(false); load() }} />}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-400">No properties yet. Add one to start tracking it.</p>
      ) : (
        <>
          {/* Portfolio overview */}
          <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
            <h2 className="mb-3 text-sm font-semibold text-indigo-900">
              Portfolio overview · {portfolio.count} {portfolio.count === 1 ? 'property' : 'properties'}
            </h2>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Annual cash flow" value={money(portfolio.annualCashFlow)} tone={portfolio.annualCashFlow >= 0 ? 'in' : 'out'} />
              <Stat label="Total income" value={money(portfolio.totalIncome)} tone="in" />
              <Stat label="Total expenses" value={money(portfolio.totalExpenses)} tone="out" />
              <Stat label="Net (all time)" value={money(portfolio.net)} tone={portfolio.net >= 0 ? 'in' : 'out'} />
              <Stat label="Cap rate" value={pct(portfolio.capRate)} />
              <Stat label="Cash-on-cash" value={pct(portfolio.cashOnCash)} />
            </div>
          </div>

          {/* Property cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(({ property, stats }) => (
              <div
                key={property.id}
                className="group relative rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
              >
                <Link to={`/properties/${property.id}`} className="block">
                  <h2 className="text-lg font-semibold">{property.name}</h2>
                  {property.address && <p className="text-sm text-slate-400">{property.address}</p>}
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Monthly cash flow</span>
                    <span className={'text-lg font-bold ' + (stats.avgMonthlyCashFlow >= 0 ? 'text-money-in' : 'text-money-out')}>
                      {money(stats.avgMonthlyCashFlow)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-slate-400">
                    <span>Cap {pct(stats.capRate)}</span>
                    <span>CoC {pct(stats.cashOnCash)}</span>
                    <span>{stats.monthsTracked} mo tracked</span>
                  </div>
                </Link>
                <button
                  onClick={() => remove(property.id, property.name)}
                  className="absolute right-3 top-3 hidden text-xs text-slate-300 hover:text-money-out group-hover:block"
                  title="Delete property"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function AddProperty({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    name: '',
    address: '',
    purchasePrice: '',
    downPayment: '',
    closingCosts: '',
    rehab: '',
    rate: '',
    termYears: '30',
  })
  const [paidOff, setPaidOff] = useState(false)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const num = (v: string) => parseFloat(v) || 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.name.trim()) return
    await api.createProperty(f.name.trim(), f.address.trim(), {
      purchasePrice: num(f.purchasePrice),
      downPayment: num(f.downPayment),
      closingCosts: num(f.closingCosts),
      rehab: num(f.rehab),
      rate: num(f.rate),
      termYears: num(f.termYears),
      paidOff,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name" value={f.name} onChange={(v) => set('name', v)} type="text" placeholder="My house" />
        <Field label="Address" value={f.address} onChange={(v) => set('address', v)} type="text" placeholder="123 Main St" />
        <Field label="Purchase price" value={f.purchasePrice} onChange={(v) => set('purchasePrice', v)} prefix="$" />
        <Field label="Down payment" value={f.downPayment} onChange={(v) => set('downPayment', v)} prefix="$" />
        <Field label="Closing costs" value={f.closingCosts} onChange={(v) => set('closingCosts', v)} prefix="$" />
        <Field label="Rehab" value={f.rehab} onChange={(v) => set('rehab', v)} prefix="$" />
        <Field label="Interest rate" value={f.rate} onChange={(v) => set('rate', v)} suffix="%" />
        <Field label="Loan term" value={f.termYears} onChange={(v) => set('termYears', v)} suffix="yrs" />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={paidOff} onChange={(e) => setPaidOff(e.target.checked)} className="h-4 w-4 accent-ink" />
        Owned free &amp; clear (no mortgage)
      </label>
      <div className="mt-3">
        <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Create property
        </button>
        <span className="ml-3 text-xs text-slate-400">
          Purchase details power the cap-rate / cash-on-cash math — you can edit them later.
        </span>
      </div>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  prefix,
  suffix,
  type = 'number',
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  prefix?: string
  suffix?: string
  type?: string
  placeholder?: string
}) {
  return (
    <label className="flex flex-col">
      <span className="mb-1 text-[11px] font-medium text-slate-500">{label}</span>
      <div className="flex items-center rounded-lg border border-slate-300 px-2 focus-within:border-slate-400">
        {prefix && <span className="text-sm text-slate-400">{prefix}</span>}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-1 py-1.5 text-sm outline-none"
        />
        {suffix && <span className="text-sm text-slate-400">{suffix}</span>}
      </div>
    </label>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'in' | 'out' }) {
  const color = tone === 'in' ? 'text-money-in' : tone === 'out' ? 'text-money-out' : 'text-ink'
  return (
    <div className="rounded-lg bg-white p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={'mt-0.5 text-lg font-bold ' + color}>{value}</div>
    </div>
  )
}

function pct(v: number): string {
  return `${v.toFixed(1)}%`
}
