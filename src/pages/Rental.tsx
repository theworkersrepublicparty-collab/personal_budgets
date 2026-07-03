import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { money } from '../lib/format'
import MetricGlossary from '../components/MetricGlossary'

// A standalone rental-property analyzer (like BiggerPockets). Pure what-if math —
// nothing is imported and nothing hits the database. Your inputs are remembered
// in this browser via localStorage so the numbers stick between visits.

type Form = Record<string, string>

const DEFAULTS: Form = {
  address: '',
  allCash: '0', // '1' = paid in full, no loan
  price: '250000',
  closing: '5000',
  rehab: '0',
  downPct: '20',
  rate: '7',
  termYears: '30',
  points: '0',
  rent: '1800',
  otherIncome: '0',
  taxesYr: '3000',
  insuranceYr: '1200',
  hoa: '0',
  utilities: '0',
  garbage: '0',
  vacancyPct: '5',
  repairsPct: '5',
  capexPct: '5',
  mgmtPct: '0',
}

const STORAGE_KEY = 'rentalCalc.v1'

export default function Rental() {
  const [f, setF] = useState<Form>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS
    } catch {
      return DEFAULTS
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(f))
  }, [f])

  const set = (key: string, val: string) => setF((prev) => ({ ...prev, [key]: val }))
  const n = (key: string) => parseFloat(f[key]) || 0

  // --- the math ---
  const allCash = f.allCash === '1'
  const price = n('price')
  const down = allCash ? price : (price * n('downPct')) / 100
  const loan = allCash ? 0 : Math.max(0, price - down)
  const pointsCost = allCash ? 0 : (loan * n('points')) / 100
  // Cash needed: with a loan it's down + costs; all-cash it's the whole price + costs.
  const cashNeeded = (allCash ? price : down) + n('closing') + n('rehab') + pointsCost

  const r = n('rate') / 100 / 12
  const months = n('termYears') * 12
  const mortgage =
    allCash || months <= 0
      ? 0
      : r === 0
        ? loan / months
        : (loan * r * (1 + r) ** months) / ((1 + r) ** months - 1)

  const rent = n('rent')
  const grossIncome = rent + n('otherIncome')

  const vacancy = (rent * n('vacancyPct')) / 100
  const mgmt = (rent * n('mgmtPct')) / 100
  const repairs = (rent * n('repairsPct')) / 100
  const capex = (rent * n('capexPct')) / 100
  const taxesM = n('taxesYr') / 12
  const insM = n('insuranceYr') / 12

  const opExpenses = taxesM + insM + n('hoa') + n('utilities') + n('garbage') + vacancy + mgmt + repairs + capex
  const noiM = grossIncome - opExpenses // operating income, excludes mortgage
  const cashFlowM = noiM - mortgage
  const cashFlowY = cashFlowM * 12
  const noiY = noiM * 12

  const capRate = price > 0 ? (noiY / price) * 100 : 0
  const coc = cashNeeded > 0 ? (cashFlowY / cashNeeded) * 100 : 0
  const onePct = price > 0 ? (rent / price) * 100 : 0
  // 50% rule: rough operating expenses ≈ 50% of rent (excludes mortgage).
  const expenseRatio = rent > 0 ? (opExpenses / rent) * 100 : 0

  const pct = (v: number) => `${v.toFixed(1)}%`

  return (
    <div>
      <div className="mb-1">
        <Link to="/" className="text-sm text-slate-400 hover:text-ink">
          ← All budgets
        </Link>
      </div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">🏠 Rental Property Calculator</h1>
        <p className="text-sm text-slate-400">
          See if renting out a property cash-flows. Everything updates live; your numbers are saved
          in this browser.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Inputs */}
        <div className="space-y-4">
          <Group title="Property">
            <Field label="Address (optional)" value={f.address} onChange={(v) => set('address', v)} type="text" />
            <Field label="Purchase price" value={f.price} onChange={(v) => set('price', v)} prefix="$" />
            <Field label="Closing costs" value={f.closing} onChange={(v) => set('closing', v)} prefix="$" />
            <Field label="Rehab / repairs (upfront)" value={f.rehab} onChange={(v) => set('rehab', v)} prefix="$" />
          </Group>

          <Group title="Loan">
            <label className="col-span-full flex items-center gap-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={allCash}
                onChange={(e) => set('allCash', e.target.checked ? '1' : '0')}
                className="h-4 w-4 accent-ink"
              />
              All cash — no loan (paid off)
            </label>
            {!allCash && (
              <>
                <Field label="Down payment" value={f.downPct} onChange={(v) => set('downPct', v)} suffix="%" />
                <Field label="Interest rate" value={f.rate} onChange={(v) => set('rate', v)} suffix="%" />
                <Field label="Loan term" value={f.termYears} onChange={(v) => set('termYears', v)} suffix="yrs" />
                <Field label="Points" value={f.points} onChange={(v) => set('points', v)} suffix="%" />
              </>
            )}
            <div className="col-span-full text-xs text-slate-400">
              {allCash ? `Paying ${money(price)} in cash — no mortgage.` : `Loan amount ${money(loan)} · Down payment ${money(down)}`}
            </div>
          </Group>

          <Group title="Income (monthly)">
            <Field label="Rent" value={f.rent} onChange={(v) => set('rent', v)} prefix="$" />
            <Field label="Other income" value={f.otherIncome} onChange={(v) => set('otherIncome', v)} prefix="$" />
          </Group>

          <Group title="Expenses">
            <Field label="Property taxes (per year)" value={f.taxesYr} onChange={(v) => set('taxesYr', v)} prefix="$" />
            <Field label="Insurance (per year)" value={f.insuranceYr} onChange={(v) => set('insuranceYr', v)} prefix="$" />
            <Field label="HOA (per month)" value={f.hoa} onChange={(v) => set('hoa', v)} prefix="$" />
            <Field label="Utilities (per month)" value={f.utilities} onChange={(v) => set('utilities', v)} prefix="$" />
            <Field label="Garbage / sewer (per month)" value={f.garbage} onChange={(v) => set('garbage', v)} prefix="$" />
            <Field label="Vacancy (% of rent)" value={f.vacancyPct} onChange={(v) => set('vacancyPct', v)} suffix="%" />
            <Field label="Repairs & maintenance (% of rent)" value={f.repairsPct} onChange={(v) => set('repairsPct', v)} suffix="%" />
            <Field label="CapEx (% of rent)" value={f.capexPct} onChange={(v) => set('capexPct', v)} suffix="%" />
            <Field label="Property management (% of rent)" value={f.mgmtPct} onChange={(v) => set('mgmtPct', v)} suffix="%" />
          </Group>
        </div>

        {/* Results */}
        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Metric
            label="Monthly cash flow"
            value={money(cashFlowM)}
            sub={`${money(cashFlowY)} / year`}
            tone={cashFlowM >= 0 ? 'good' : 'bad'}
            big
          />
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Cash-on-cash" value={pct(coc)} tone={coc >= 8 ? 'good' : coc >= 0 ? 'warn' : 'bad'} />
            <Metric label="Cap rate" value={pct(capRate)} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <Row label="Mortgage (P&I)" value={money(mortgage) + '/mo'} />
            <Row label="Operating expenses" value={money(opExpenses) + '/mo'} />
            <Row label="NOI (net operating income)" value={money(noiY) + '/yr'} />
            <Row label="Total cash needed" value={money(cashNeeded)} />
            <div className="my-2 border-t border-slate-100" />
            <Row
              label="1% rule (rent ÷ price)"
              value={pct(onePct)}
              hint={onePct >= 1 ? '✓ passes' : 'below 1%'}
              good={onePct >= 1}
            />
            <Row
              label="50% rule (expenses ÷ rent)"
              value={pct(expenseRatio)}
              hint={expenseRatio <= 50 ? '✓ under 50%' : 'over 50%'}
              good={expenseRatio <= 50}
            />
          </div>

          <p className="px-1 text-[11px] leading-relaxed text-slate-400">
            Cash-on-cash 8–12%+ is a common target. The 1% & 50% rules are quick rough filters, not
            gospel — always sanity-check the real numbers.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <MetricGlossary />
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  prefix,
  suffix,
  type = 'number',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  prefix?: string
  suffix?: string
  type?: string
}) {
  return (
    <label className="flex flex-col">
      <span className="mb-1 text-[11px] font-medium text-slate-500">{label}</span>
      <div className="flex items-center rounded-lg border border-slate-300 px-2 focus-within:border-slate-400">
        {prefix && <span className="text-sm text-slate-400">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-1 py-1.5 text-sm outline-none"
        />
        {suffix && <span className="text-sm text-slate-400">{suffix}</span>}
      </div>
    </label>
  )
}

function Metric({
  label,
  value,
  sub,
  tone,
  big,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'good' | 'bad' | 'warn'
  big?: boolean
}) {
  const color =
    tone === 'good' ? 'text-money-in' : tone === 'bad' ? 'text-money-out' : tone === 'warn' ? 'text-amber-500' : 'text-ink'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 font-bold ${big ? 'text-3xl' : 'text-xl'} ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}

function Row({
  label,
  value,
  hint,
  good,
}: {
  label: string
  value: string
  hint?: string
  good?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-slate-500">{label}</span>
      <span className="text-right">
        <span className="font-semibold">{value}</span>
        {hint && (
          <span className={'ml-2 text-xs ' + (good ? 'text-money-in' : 'text-money-out')}>{hint}</span>
        )}
      </span>
    </div>
  )
}
