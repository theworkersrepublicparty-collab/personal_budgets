import { useMemo, useState } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
} from '@tanstack/react-table'
import type { Transaction } from '../../shared/types'
import { money } from '../lib/format'

const col = createColumnHelper<Transaction>()

// Key used in the checkbox list to mean "rows with no category/section".
const BLANK = '(blank)'

// Excel-style multi-select filter: the filter value is an array of checked
// values. A row passes if its value is one of the checked boxes. Empty array =
// no filter (show everything). Blank rows match the BLANK checkbox.
const includesSome: FilterFn<Transaction> = (row, columnId, value) => {
  const selected = value as string[] | undefined
  if (!selected || selected.length === 0) return true
  const cell = row.getValue(columnId)
  const key = cell ? String(cell) : BLANK
  return selected.includes(key)
}

export default function TxnTable({
  txns,
  currency,
  showSection,
  categories,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onSetCategory,
  onEdit,
  onDelete,
}: {
  txns: Transaction[]
  currency: string
  showSection: boolean
  categories: string[]
  selectedIds: Set<number>
  onToggleRow: (id: number) => void
  onToggleAll: (ids: number[], select: boolean) => void
  onSetCategory: (txn: Transaction, category: string) => void
  onEdit: (txn: Transaction) => void
  onDelete: (txn: Transaction) => void
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'txn_date', desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const columns = useMemo(
    () => [
      col.display({
        id: 'select',
        enableSorting: false,
        enableColumnFilter: false,
        // Select-all targets only the rows currently visible after filtering.
        header: ({ table }) => {
          const ids = table.getFilteredRowModel().rows.map((r) => r.original.id)
          const allSel = ids.length > 0 && ids.every((id) => selectedIds.has(id))
          return (
            <input
              type="checkbox"
              aria-label="Select all rows"
              checked={allSel}
              onChange={(e) => onToggleAll(ids, e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-ink"
            />
          )
        },
        cell: (c) => (
          <input
            type="checkbox"
            aria-label="Select row"
            checked={selectedIds.has(c.row.original.id)}
            onChange={() => onToggleRow(c.row.original.id)}
            className="h-4 w-4 cursor-pointer accent-ink"
          />
        ),
      }),
      col.accessor('txn_date', {
        header: 'Date',
        filterFn: 'includesString',
        cell: (c) => c.getValue() || '—',
      }),
      col.accessor('description', {
        header: 'Description',
        filterFn: 'includesString',
        cell: (c) => <span className="block max-w-[360px] truncate">{c.getValue()}</span>,
      }),
      col.accessor('category', {
        header: 'Category',
        filterFn: includesSome,
        cell: (c) => {
          const txn = c.row.original
          const value = c.getValue() ?? ''
          return (
            <select
              value={value}
              onChange={(e) => onSetCategory(txn, e.target.value)}
              className="max-w-[150px] rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 hover:border-slate-300"
            >
              <option value="">— none —</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              {value && !categories.includes(value) && <option value={value}>{value}</option>}
            </select>
          )
        },
      }),
      ...(showSection
        ? [
            col.accessor('section', {
              header: 'Section',
              filterFn: 'includesString',
              cell: (c) => c.getValue() || '—',
            }),
          ]
        : []),
      col.accessor('amount', {
        enableColumnFilter: false,
        header: () => <div className="text-right">Amount</div>,
        cell: (c) => {
          const v = c.getValue()
          return (
            <div className={'text-right font-medium ' + (v >= 0 ? 'text-money-in' : 'text-money-out')}>
              {money(v, currency)}
            </div>
          )
        },
      }),
      col.display({
        id: 'actions',
        enableSorting: false,
        enableColumnFilter: false,
        header: () => <div className="text-right">·</div>,
        cell: (c) => {
          const txn = c.row.original
          return (
            <div className="flex justify-end gap-1">
              <button
                onClick={() => onEdit(txn)}
                aria-label="Edit transaction"
                className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✎
              </button>
              <button
                onClick={() => onDelete(txn)}
                aria-label="Delete transaction"
                className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-money-out"
              >
                🗑
              </button>
            </div>
          )
        },
      }),
    ],
    [currency, showSection, categories, selectedIds, onToggleRow, onToggleAll, onSetCategory, onEdit, onDelete],
  )

  const table = useReactTable({
    data: txns,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  if (txns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
        No transactions match this view. Import a statement to get started.
      </div>
    )
  }

  const rows = table.getRowModel().rows

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const canSort = h.column.getCanSort()
                return (
                  <th key={h.id} className="px-4 py-2 align-top font-semibold">
                    <div
                      onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                      className={'select-none ' + (canSort ? 'cursor-pointer' : '')}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {canSort
                        ? ({ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? '')
                        : ''}
                    </div>
                    {h.column.getCanFilter() && (
                      <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                        <ColumnFilter column={h.column} />
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={table.getAllColumns().length}
                className="px-4 py-8 text-center text-sm text-slate-400"
              >
                No rows match these column filters.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onToggleRow(row.original.id)}
              className={
                'cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 ' +
                (selectedIds.has(row.original.id) ? 'bg-indigo-50' : '')
              }
            >
              {row.getVisibleCells().map((cell) => {
                // Clicks on the controls (checkbox, category dropdown, edit/delete)
                // must NOT also toggle the row — let those handle their own click.
                const interactive = ['select', 'category', 'actions'].includes(cell.column.id)
                return (
                  <td
                    key={cell.id}
                    className="px-4 py-2"
                    onClick={interactive ? (e) => e.stopPropagation() : undefined}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Per-column header filter. The Category column gets an Excel-style checkbox
// dropdown (pick one or many, clear all); every other column gets a plain
// "contains" text box.
function ColumnFilter({ column }: { column: Column<Transaction, unknown> }) {
  if (column.id === 'category') return <CheckboxFilter column={column} />

  const value = (column.getFilterValue() ?? '') as string
  return (
    <input
      value={value}
      placeholder="filter…"
      onChange={(e) => column.setFilterValue(e.target.value || undefined)}
      className="w-full max-w-[200px] rounded border border-slate-200 px-1.5 py-1 text-xs font-normal normal-case text-slate-700"
    />
  )
}

// Excel autofilter: a dropdown of checkboxes for the distinct values present
// (plus "(blank)"), with Select all / Clear. Checking none = show everything.
function CheckboxFilter({ column }: { column: Column<Transaction, unknown> }) {
  const [open, setOpen] = useState(false)
  const selected = (column.getFilterValue() as string[] | undefined) ?? []

  const values = [...column.getFacetedUniqueValues().keys()]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .sort((a, b) => a.localeCompare(b))
  const allKeys = [BLANK, ...values]

  function toggle(key: string) {
    const set = new Set(selected)
    set.has(key) ? set.delete(key) : set.add(key)
    column.setFilterValue(set.size ? [...set] : undefined)
  }

  const label = selected.length === 0 ? 'All ▾' : `${selected.length} picked ▾`

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full max-w-[150px] truncate rounded border border-slate-200 bg-white px-1.5 py-1 text-left text-xs font-normal normal-case text-slate-700 hover:border-slate-300"
      >
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 max-h-64 w-52 overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-xs font-normal normal-case shadow-lg">
            <div className="mb-1 flex justify-between border-b border-slate-100 pb-1">
              <button
                type="button"
                onClick={() => column.setFilterValue(allKeys)}
                className="font-medium text-indigo-600 hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => column.setFilterValue(undefined)}
                className="font-medium text-slate-500 hover:underline"
              >
                Clear all
              </button>
            </div>
            {allKeys.map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(key)}
                  onChange={() => toggle(key)}
                  className="h-3.5 w-3.5 accent-ink"
                />
                <span className={key === BLANK ? 'italic text-slate-400' : 'text-slate-700'}>
                  {key === BLANK ? 'blank / uncategorized' : key}
                </span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
