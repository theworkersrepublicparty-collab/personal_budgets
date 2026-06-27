import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Kpis } from '../../shared/types'
import { money, monthLabel } from '../lib/format'

const CAT_COLORS = [
  '#6366f1', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#a855f7', '#ec4899',
  '#84cc16', '#0ea5e9', '#f97316', '#14b8a6', '#8b5cf6', '#eab308', '#f43f5e',
  '#22c55e', '#3b82f6', '#d946ef', '#64748b',
]

export function MonthlyChart({ kpis, currency }: { kpis: Kpis; currency: string }) {
  const data = kpis.byMonth.map((m) => ({ ...m, label: monthLabel(m.month) }))
  if (data.length === 0) return <Empty>No monthly data yet</Empty>
  return (
    <Panel title="Money in vs out by month">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis fontSize={11} tickLine={false} axisLine={false} width={48} />
          <Tooltip formatter={(v: number) => money(v, currency)} />
          <Legend />
          <Bar dataKey="in" name="In" fill="#16a34a" radius={[3, 3, 0, 0]} />
          <Bar dataKey="out" name="Out" fill="#dc2626" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  )
}

export function CategoryChart({ kpis, currency }: { kpis: Kpis; currency: string }) {
  // Show every spending category as its own slice (sorted biggest first).
  const data = kpis.byCategory
  if (data.length === 0) return <Empty>No spending categories yet</Empty>

  // Grow the chart with the number of categories so the legend never squeezes
  // the circle. The pie radius scales with the available height.
  const height = Math.max(380, data.length * 30 + 120)
  const outerRadius = Math.min(Math.round(height / 2) - 60, 180)

  return (
    <Panel title="Spending by category">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="category"
            cx="42%"
            cy="50%"
            outerRadius={outerRadius}
            // Label slices that are at least 4% of spending with their percentage;
            // tiny slivers stay unlabeled so they don't overlap.
            label={({ percent }) => (percent >= 0.04 ? `${Math.round(percent * 100)}%` : '')}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => money(v, currency)} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            wrapperStyle={{ fontSize: 12, lineHeight: '1.4em', maxWidth: '34%' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </Panel>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-600">{title}</h3>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-sm text-slate-300">
      {children}
    </div>
  )
}
