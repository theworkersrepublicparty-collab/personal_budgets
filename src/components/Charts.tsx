import {
  Bar,
  BarChart,
  Cell,
  LabelList,
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

// Horizontal stacked bars: one bar per month, split into colored category
// segments (the bar's length = that month's total spending). A separate green
// bar shows that month's income next to it. Colors match the pie (same category
// order), so a category is the same color in both charts.
export function MonthlyByCategoryChart({ kpis, currency }: { kpis: Kpis; currency: string }) {
  const categories = kpis.byCategory.map((c) => c.category) // sorted biggest first = pie order
  const data = kpis.byMonthCategory.map((m) => ({
    label: monthLabel(m.month),
    income: m.income,
    total: m.total, // total spending — shown at the end of the stack
    _end: 0, // invisible cap bar that carries the spending-total label
    ...m.cats,
  }))
  if (data.length === 0) return <Empty>No monthly spending yet</Empty>

  const height = Math.max(320, data.length * 46 + 120)
  const shortMoney = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`
  const totalFmt = (v: number) => '$' + Math.round(v).toLocaleString()

  return (
    <Panel title="Monthly spending by category">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 56, bottom: 0, left: 8 }}>
          <XAxis type="number" fontSize={11} tickLine={false} tickFormatter={shortMoney} />
          <YAxis type="category" dataKey="label" width={92} fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v: number) => money(v, currency)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {categories.map((c, i) => (
            <Bar key={c} dataKey={c} stackId="spend" fill={CAT_COLORS[i % CAT_COLORS.length]} />
          ))}
          {/* invisible 0-width cap at the end of the spending stack, just to print the total */}
          <Bar dataKey="_end" stackId="spend" fill="transparent" legendType="none" isAnimationActive={false}>
            <LabelList dataKey="total" position="right" formatter={totalFmt} fontSize={11} fill="#dc2626" />
          </Bar>
          <Bar dataKey="income" name="Income" stackId="income" fill="#16a34a" radius={[0, 3, 3, 0]}>
            <LabelList dataKey="income" position="right" formatter={totalFmt} fontSize={11} fill="#16a34a" />
          </Bar>
        </BarChart>
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
