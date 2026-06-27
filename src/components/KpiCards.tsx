import type { Kpis } from '../../shared/types'
import { money } from '../lib/format'

export default function KpiCards({ kpis, currency }: { kpis: Kpis; currency: string }) {
  const cards = [
    { label: 'Money In', value: money(kpis.moneyIn, currency), tone: 'in', sub: `${kpis.credits} credits` },
    { label: 'Money Out', value: money(kpis.moneyOut, currency), tone: 'out', sub: `${kpis.debits} debits` },
    {
      label: 'Net',
      value: money(kpis.net, currency),
      tone: kpis.net >= 0 ? 'in' : 'out',
      sub: kpis.net >= 0 ? 'surplus' : 'deficit',
    },
    { label: 'Transactions', value: String(kpis.count), tone: 'neutral', sub: 'in current view' },
  ] as const

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{c.label}</div>
          <div
            className={
              'mt-1 text-2xl font-bold ' +
              (c.tone === 'in' ? 'text-money-in' : c.tone === 'out' ? 'text-money-out' : 'text-ink')
            }
          >
            {c.value}
          </div>
          <div className="mt-1 text-xs text-slate-400">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}
