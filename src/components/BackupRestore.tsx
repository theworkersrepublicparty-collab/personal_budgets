import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { api } from '../lib/api'

// The user-facing "tabs" you can back up, each mapped to the sheet names the
// server writes. `marker` sheets are what we look for to detect a tab inside an
// uploaded file. Keep this in sync with server/backup.ts.
type GroupKey = 'budgets' | 'planner' | 'properties' | 'recipes'

const GROUPS: { key: GroupKey; label: string; emoji: string; sheets: string[]; note?: string }[] = [
  { key: 'budgets', label: 'Budgets & Transactions', emoji: '🧮', sheets: ['Budgets', 'Transactions'] },
  { key: 'planner', label: 'Yearly Planner', emoji: '📅', sheets: ['Planner'] },
  { key: 'properties', label: 'Properties', emoji: '🏠', sheets: ['Properties', 'PropertyEntries', 'Leases', 'PropertyCategories'] },
  { key: 'recipes', label: 'Food Recipes', emoji: '🍽️', sheets: ['Recipes'], note: 'photos not included' },
]

export default function BackupRestore({ onClose }: { onClose: () => void }) {
  // Download: which tabs to include (all on by default).
  const [selected, setSelected] = useState<Set<GroupKey>>(new Set(GROUPS.map((g) => g.key)))

  // Restore: the chosen file + which tabs it turned out to contain.
  const [file, setFile] = useState<File | null>(null)
  const [foundGroups, setFoundGroups] = useState<GroupKey[]>([])
  const [restoreSel, setRestoreSel] = useState<Set<GroupKey>>(new Set())
  const [fileError, setFileError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  function toggle(set: Set<GroupKey>, key: GroupKey, setter: (s: Set<GroupKey>) => void) {
    const next = new Set(set)
    next.has(key) ? next.delete(key) : next.add(key)
    setter(next)
  }

  const [downloading, setDownloading] = useState(false)

  async function download() {
    const groups = GROUPS.filter((g) => selected.has(g.key)).map((g) => g.key)
    if (!groups.length) return
    setDownloading(true)
    try {
      // Pull the file as a blob (not a raw navigation) so a down/unreachable
      // server surfaces a real error instead of a "site not available" page,
      // and so the saved file always gets a proper .xlsx name.
      const res = await fetch(api.exportUrl(groups))
      if (!res.ok) throw new Error(`server responded ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `budgets-backup-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(
        `Download failed: ${(err as Error).message}.\n\n` +
          'Make sure the app is running with "npm run dev" (both the web and API servers).',
      )
    } finally {
      setDownloading(false)
    }
  }

  // Read the file in the browser to discover which tabs it contains — no upload
  // needed until the user actually confirms the restore.
  async function inspect(f: File) {
    setFile(f)
    setFileError(null)
    setFoundGroups([])
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
      const names = new Set(wb.SheetNames)
      const found = GROUPS.filter((g) => g.sheets.some((s) => names.has(s))).map((g) => g.key)
      if (!found.length) {
        setFileError("This file doesn't look like a Personal Budgets backup.")
        return
      }
      setFoundGroups(found)
      setRestoreSel(new Set(found)) // default: restore everything the file has
    } catch {
      setFileError('Could not read this file — is it a .xlsx backup?')
    }
  }

  async function restore() {
    if (!file) return
    const groups = foundGroups.filter((g) => restoreSel.has(g))
    if (!groups.length) return
    const labels = GROUPS.filter((g) => groups.includes(g.key)).map((g) => g.label)
    if (
      !confirm(
        `This will REPLACE all data in these tabs with the backup:\n\n• ${labels.join(
          '\n• ',
        )}\n\nAny other tabs are left as they are. Continue?`,
      )
    )
      return
    setRestoring(true)
    try {
      await api.importBackup(file, groups)
      alert('Restore complete. Reloading the app…')
      window.location.reload()
    } catch (err) {
      setRestoring(false)
      alert(`Restore failed: ${(err as Error).message}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">💾 Backup &amp; Restore</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        {/* Download */}
        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Download a backup</h3>
          <p className="mt-1 text-xs text-slate-400">
            Pick which tabs to include. You get one Excel file — keep it as a backup or move it to
            another computer and restore below.
          </p>
          <div className="mt-3 space-y-2">
            {GROUPS.map((g) => (
              <label key={g.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(g.key)}
                  onChange={() => toggle(selected, g.key, setSelected)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>
                  {g.emoji} {g.label}
                  {g.note && <span className="ml-1 text-xs text-slate-400">({g.note})</span>}
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={download}
            disabled={selected.size === 0 || downloading}
            className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {downloading ? 'Preparing…' : '⬇ Download .xlsx'}
          </button>
        </section>

        {/* Restore */}
        <section className="mt-4 rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Restore from a backup</h3>
          <p className="mt-1 text-xs text-slate-400">
            Choose a backup file. Restoring <b>replaces</b> everything in whichever tabs the file
            contains — tabs not in the file stay as they are.
          </p>

          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => e.target.files?.[0] && inspect(e.target.files[0])}
            className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200"
          />

          {fileError && <p className="mt-3 text-sm text-money-out">{fileError}</p>}

          {foundGroups.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">
                This file will replace these tabs:
              </p>
              <div className="mt-2 space-y-2">
                {GROUPS.filter((g) => foundGroups.includes(g.key)).map((g) => (
                  <label key={g.key} className="flex items-center gap-2 text-sm text-amber-900">
                    <input
                      type="checkbox"
                      checked={restoreSel.has(g.key)}
                      onChange={() => toggle(restoreSel, g.key, setRestoreSel)}
                      className="h-4 w-4 rounded border-amber-300"
                    />
                    <span>
                      {g.emoji} {g.label}
                    </span>
                  </label>
                ))}
              </div>
              <button
                onClick={restore}
                disabled={restoring || restoreSel.size === 0}
                className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
              >
                {restoring ? 'Restoring…' : '♻ Restore selected (replaces data)'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
