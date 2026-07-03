import {
  Bar,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { money, monthLabel } from '../lib/format'
import type { PropertyStats } from '../lib/property'

const COLORS = [
  '#6366f1', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#a855f7', '#ec4899',
  '#84cc16', '#0ea5e9', '#f97316', '#14b8a6', '#8b5cf6', '#eab308', '#f43f5e',
  '#22c55e', '#3b82f6', '#d946ef', '#64748b',
]

const shortMoney = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`)

export function CashFlowChart({ stats }: { stats: PropertyStats }) {
  const data = stats.byMonth.map((m) => ({ ...m, label: monthLabel(m.month) }))
  if (data.length === 0) return <Panel title="Cash flow by month"><Empty /></Panel>
  return (
    <Panel title="Cash flow by month">
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis fontSize={11} tickLine={false} axisLine={false} width={52} />
          <Tooltip formatter={(v: number) => money(v)} />
          <Legend />
          <Bar dataKey="income" name="Income" fill="#16a34a" radius={[3, 3, 0, 0]}>
            <LabelList dataKey="income" position="top" formatter={shortMoney} fontSize={10} fill="#16a34a" />
          </Bar>
          <Bar dataKey="expense" name="Expenses" fill="#dc2626" radius={[3, 3, 0, 0]}>
            <LabelList dataKey="expense" position="top" formatter={shortMoney} fontSize={10} fill="#dc2626" />
          </Bar>
          <Line dataKey="net" name="Net" stroke="#6366f1" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
  )
}

export function ExpensePie({ stats }: { stats: PropertyStats }) {
  const data = stats.byCategory
  if (data.length === 0) return <Panel title="Expenses by category"><Empty /></Panel>
  return (
    <Panel title="Expenses by category">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="category"
            cx="42%"
            cy="50%"
            outerRadius={95}
            label={({ percent }) => (percent >= 0.05 ? `${Math.round(percent * 100)}%` : '')}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => money(v)} />
          <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
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

function Empty() {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-slate-300">
      No data yet — add entries below.
    </div>
  )
}
