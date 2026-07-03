import { useState } from 'react'

// Plain-language definitions + the actual formula for each metric, so the
// numbers on the dashboard aren't a black box.
const TERMS: { term: string; what: string; math: string }[] = [
  {
    term: 'Cash Flow',
    what: 'The money left in your pocket after everything is paid, including the mortgage. The bottom line of being a landlord.',
    math: 'Income − all expenses (mortgage included)',
  },
  {
    term: 'NOI (Net Operating Income)',
    what: 'Profit from running the property, before the loan. Used to judge the property itself, separate from how you financed it.',
    math: 'Income − operating expenses (mortgage NOT included)',
  },
  {
    term: 'Cap Rate',
    what: 'The yearly return if you paid all cash. Lets you compare properties regardless of financing. Higher = better income for the price.',
    math: 'Annual NOI ÷ purchase price × 100',
  },
  {
    term: 'Cash-on-Cash Return',
    what: 'The return on the actual cash you put in. 8–12%+ is a common target.',
    math: 'Annual cash flow ÷ cash invested × 100',
  },
  {
    term: 'Cash Invested',
    what: 'The real money out of your pocket to acquire it.',
    math: 'Down payment + closing costs + rehab',
  },
  {
    term: '1% Rule',
    what: 'A quick screen: monthly rent should be at least 1% of the price. A fast filter, not a verdict.',
    math: 'Monthly rent ÷ purchase price × 100  (want ≥ 1%)',
  },
  {
    term: '50% Rule',
    what: 'A rough sanity check: operating costs tend to eat ~half of rent. If yours are well over 50%, dig in.',
    math: 'Operating expenses ÷ income × 100  (want ≤ 50%)',
  },
]

export default function MetricGlossary() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="text-sm font-semibold text-slate-700">📖 What do these numbers mean?</span>
        <span className="text-xs font-medium text-slate-400">{open ? 'Hide ▲' : 'Show ▼'}</span>
      </button>
      {open && (
        <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
          {TERMS.map((t) => (
            <div key={t.term} className="rounded-lg bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-800">{t.term}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{t.what}</p>
              <code className="mt-2 block rounded bg-white px-2 py-1 text-[11px] text-indigo-700">
                {t.math}
              </code>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
