import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../lib/api'
import type {
  Workout,
  WorkoutDoc,
  WorkoutExercise,
  WorkoutLog,
  WorkoutStats,
} from '../../shared/types'

// A single reps/weight cell. Derived from the exercise shape so we never rely
// on a type name that may not be exported from shared/types.
type WorkoutCell = WorkoutExercise['cells'][number]
type WorkoutGroups = Workout['groups']

/* ============================ shared button styles ============================ */
const BTN = 'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40'
const BTN_SM = 'rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40'
const BTN_PRIMARY = 'rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40'
const BTN_PRIMARY_SM = 'rounded-lg bg-ink px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40'
const BTN_DANGER_SM = 'rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-money-out hover:bg-red-50'

/* ============================ helpers ============================ */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function todayKey(): string {
  const t = new Date()
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate())
}
function uid(prefix: string): string {
  return prefix + '-' + Math.random().toString(36).slice(2, 9)
}

function calcBMI(weight: number | null, height: number | null): number | null {
  if (!weight || !height) return null
  return (weight / (height * height)) * 703
}
function bmiLabel(bmi: number | null): string {
  if (bmi == null) return '—'
  if (bmi < 18.5) return 'Underweight'
  if (bmi < 25) return 'Normal'
  if (bmi < 30) return 'Overweight'
  return 'Obese'
}
// Height is stored internally as total inches (keeps the BMI math simple); this
// presents it back in the feet-and-inches form people actually think in.
function formatHeight(inches: number | null): string {
  if (inches == null) return '—'
  const ft = Math.floor(inches / 12)
  const inch = +(inches - ft * 12).toFixed(1)
  return `${ft}' ${inch}"`
}

interface FlatWorkout {
  key: string
  label: string
  w: Workout
  progName: string
  catName: string
}
function allWorkoutsFlat(doc: WorkoutDoc): FlatWorkout[] {
  const list: FlatWorkout[] = []
  doc.categories.forEach((cat) => {
    cat.programs.forEach((prog) => {
      prog.workouts.forEach((w) => {
        list.push({
          key: `${cat.id}::${prog.id}::${w.id}`,
          label: `${cat.name} › ${prog.name} › ${w.name}`,
          w,
          progName: prog.name,
          catName: cat.name,
        })
      })
    })
  })
  return list
}

interface FlatExercise {
  type: string
  name: string
  cells: WorkoutCell[]
}
function flattenExercises(groups: WorkoutGroups): FlatExercise[] {
  const list: FlatExercise[] = []
  groups.forEach((g) => g.exercises.forEach((ex) => list.push({ type: g.type, name: ex.name, cells: ex.cells })))
  return list
}
function lastNumericWeight(cells: WorkoutCell[]): number | null {
  for (let i = cells.length - 1; i >= 0; i--) {
    const v = parseFloat(cells[i].weight)
    if (!isNaN(v)) return v
  }
  return null
}
function findWorkout(d: WorkoutDoc, catId: string, progId: string, wId: string): Workout | undefined {
  return d.categories
    .find((c) => c.id === catId)
    ?.programs.find((p) => p.id === progId)
    ?.workouts.find((w) => w.id === wId)
}

/* ============================ context ============================ */
interface Ctx {
  doc: WorkoutDoc
  mutate: (fn: (d: WorkoutDoc) => void) => void
  logSession: (workoutKey: string, dateStr: string) => void
  moveWorkouts: (
    fromCatId: string,
    fromProgId: string,
    workoutIds: string[],
    targetCatId: string,
    targetProgId: string,
  ) => void
  createProgram: (catId: string, name: string) => string
}
const WorkoutContext = createContext<Ctx | null>(null)
function useCtx(): Ctx {
  const c = useContext(WorkoutContext)
  if (!c) throw new Error('WorkoutContext missing')
  return c
}

/* ============================ small editable input ============================ */
// Commits on blur / Enter (mirrors the draft's native `onchange`), so typing a
// worksheet cell doesn't clone the whole doc on every keystroke.
function EditableInput({
  value,
  onCommit,
  className,
  placeholder,
  type = 'text',
}: {
  value: string
  onCommit: (v: string) => void
  className?: string
  placeholder?: string
  type?: string
}) {
  const [v, setV] = useState(value)
  useEffect(() => {
    setV(value)
  }, [value])
  return (
    <input
      type={type}
      value={v}
      placeholder={placeholder}
      className={className}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== value) onCommit(v)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

function EditableTextarea({
  value,
  onCommit,
  rows = 3,
}: {
  value: string
  onCommit: (v: string) => void
  rows?: number
}) {
  const [v, setV] = useState(value)
  useEffect(() => {
    setV(value)
  }, [value])
  return (
    <textarea
      value={v}
      rows={rows}
      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== value) onCommit(v)
      }}
    />
  )
}

/* ============================ main page ============================ */
type MainView = 'workouts' | 'analytics' | 'logs'

export default function Workouts() {
  const [doc, setDoc] = useState<WorkoutDoc | null>(null)

  // Latest doc + save-timer live in refs so the debounced persist and the
  // unmount flush always see the current value.
  const docRef = useRef<WorkoutDoc | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = useCallback((next: WorkoutDoc) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      void api.saveWorkout(next)
    }, 500)
  }, [])

  const mutate = useCallback(
    (fn: (d: WorkoutDoc) => void) => {
      const base = docRef.current
      if (!base) return
      const next = structuredClone(base)
      fn(next)
      docRef.current = next
      setDoc(next)
      scheduleSave(next)
    },
    [scheduleSave],
  )

  // Load once. Never persist on the initial load — only user edits (mutate) do.
  useEffect(() => {
    let alive = true
    void api.getWorkout().then((d) => {
      if (!alive) return
      docRef.current = d
      setDoc(d)
    })
    return () => {
      alive = false
      // Flush any pending debounced save on unmount.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
        if (docRef.current) void api.saveWorkout(docRef.current)
      }
    }
  }, [])

  /* ---- domain actions shared via context ---- */
  const logSession = useCallback(
    (workoutKey: string, dateStr: string) => {
      const cur = docRef.current
      if (!cur) return
      const found = allWorkoutsFlat(cur).find((f) => f.key === workoutKey)
      if (!found) return
      const existing = cur.logs.find((l) => l.workoutKey === workoutKey && l.date === dateStr)
      if (existing && !confirm(`A logged session for "${found.w.name}" on ${dateStr} already exists. Overwrite it with the current values?`)) {
        return
      }
      mutate((d) => {
        const f = allWorkoutsFlat(d).find((x) => x.key === workoutKey)
        if (!f) return
        const idx = d.logs.findIndex((l) => l.workoutKey === workoutKey && l.date === dateStr)
        const entry: WorkoutLog = {
          id: idx >= 0 ? d.logs[idx].id : uid('log'),
          date: dateStr,
          workoutKey,
          categoryName: f.catName,
          programName: f.progName,
          workoutName: f.w.name,
          weeks: structuredClone(f.w.weeks),
          groups: structuredClone(f.w.groups),
        }
        if (idx >= 0) d.logs[idx] = entry
        else d.logs.push(entry)
      })
    },
    [mutate],
  )

  const moveWorkouts = useCallback(
    (
      fromCatId: string,
      fromProgId: string,
      workoutIds: string[],
      targetCatId: string,
      targetProgId: string,
    ) => {
      mutate((d) => {
        const fromCat = d.categories.find((c) => c.id === fromCatId)
        const fromProg = fromCat?.programs.find((p) => p.id === fromProgId)
        const targetCat = d.categories.find((c) => c.id === targetCatId)
        const targetProg = targetCat?.programs.find((p) => p.id === targetProgId)
        if (!fromCat || !fromProg || !targetCat || !targetProg || fromProg === targetProg) return
        workoutIds.forEach((wid) => {
          const w = fromProg.workouts.find((x) => x.id === wid)
          if (!w) return
          const oldKey = `${fromCat.id}::${fromProg.id}::${w.id}`
          const newKey = `${targetCat.id}::${targetProg.id}::${w.id}`
          // Re-key calendar assignments so they follow the workout.
          Object.values(d.assignments).forEach((list) => {
            const idx = list.indexOf(oldKey)
            if (idx !== -1) list[idx] = newKey
          })
          // Re-key logged sessions + refresh their denormalized names.
          d.logs.forEach((log) => {
            if (log.workoutKey === oldKey) {
              log.workoutKey = newKey
              log.categoryName = targetCat.name
              log.programName = targetProg.name
            }
          })
          fromProg.workouts = fromProg.workouts.filter((x) => x.id !== wid)
          targetProg.workouts.push(w)
        })
      })
    },
    [mutate],
  )

  const createProgram = useCallback(
    (catId: string, name: string): string => {
      const id = uid('prog')
      mutate((d) => {
        const c = d.categories.find((x) => x.id === catId)
        if (c) c.programs.push({ id, name, workouts: [] })
      })
      return id
    },
    [mutate],
  )

  /* ---- UI-only state (not persisted) ---- */
  const [mainView, setMainView] = useState<MainView>('workouts')
  const [goalOpen, setGoalOpen] = useState(false)

  if (!doc) {
    return <p className="text-slate-400">Loading…</p>
  }

  const ctx: Ctx = { doc, mutate, logSession, moveWorkouts, createProgram }

  return (
    <WorkoutContext.Provider value={ctx}>
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">💪 Workouts</h1>
            <p className="text-sm text-slate-400">
              Plan programs, schedule them on the calendar, and log what you actually did.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['workouts', 'analytics', 'logs'] as MainView[]).map((v) => (
              <button
                key={v}
                onClick={() => setMainView(v)}
                className={
                  'rounded-lg border px-4 py-2 text-sm font-semibold capitalize transition ' +
                  (mainView === v
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-100')
                }
              >
                {v}
              </button>
            ))}
            <button onClick={() => setGoalOpen(true)} className={BTN_PRIMARY}>
              Edit Goal
            </button>
          </div>
        </div>

        <KpiBar stats={doc.stats} />

        {mainView === 'workouts' && <WorkoutsView />}
        {mainView === 'analytics' && <AnalyticsView />}
        {mainView === 'logs' && <LogsView />}

        {goalOpen && <GoalModal stats={doc.stats} onClose={() => setGoalOpen(false)} />}
      </div>
    </WorkoutContext.Provider>
  )
}

/* ============================ KPI bar ============================ */
function KpiBar({ stats }: { stats: WorkoutStats }) {
  const bmi = calcBMI(stats.weight, stats.height)
  const toGoal = stats.weight != null && stats.goal != null ? stats.weight - stats.goal : null
  const goalSub =
    stats.goal == null
      ? 'No goal set'
      : `Goal: ${stats.goal} lbs` +
        (toGoal == null
          ? ''
          : toGoal >= 0
            ? ` (${toGoal.toFixed(1)} to lose)`
            : ` (${Math.abs(toGoal).toFixed(1)} to gain)`)

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <Kpi label="Current Weight" value={stats.weight != null ? `${stats.weight} lbs` : '—'} sub={goalSub} />
      <Kpi label="BMI" value={bmi == null ? '—' : bmi.toFixed(1)} sub={bmiLabel(bmi)} />
      <Kpi label="Height" value={formatHeight(stats.height)} />
    </div>
  )
}
function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  )
}

/* ============================ Edit Goal modal ============================ */
function GoalModal({ stats, onClose }: { stats: WorkoutStats; onClose: () => void }) {
  const { mutate } = useCtx()
  const [weight, setWeight] = useState(stats.weight != null ? String(stats.weight) : '')
  const [goal, setGoal] = useState(stats.goal != null ? String(stats.goal) : '')
  const initFt = stats.height != null ? String(Math.floor(stats.height / 12)) : ''
  const initIn = stats.height != null ? String(+(stats.height - Math.floor(stats.height / 12) * 12).toFixed(1)) : ''
  const [ft, setFt] = useState(initFt)
  const [inch, setInch] = useState(initIn)

  function save() {
    const w = parseFloat(weight)
    const g = parseFloat(goal)
    const f = parseFloat(ft) || 0
    const i = parseFloat(inch) || 0
    const totalIn = f * 12 + i
    mutate((d) => {
      d.stats.weight = isNaN(w) ? null : w
      d.stats.goal = isNaN(g) ? null : g
      d.stats.height = totalIn > 0 ? totalIn : null
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Edit Goals &amp; Stats</h3>

        <label className="mt-4 flex flex-col">
          <span className="mb-1 text-[11px] font-medium text-slate-500">Current weight (lbs)</span>
          <input
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
          />
        </label>

        <label className="mt-3 flex flex-col">
          <span className="mb-1 text-[11px] font-medium text-slate-500">Goal weight (lbs)</span>
          <input
            type="number"
            step="0.1"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
          />
        </label>

        <span className="mb-1 mt-3 block text-[11px] font-medium text-slate-500">Height</span>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col">
            <input
              type="number"
              step="1"
              min="0"
              placeholder="e.g. 5"
              value={ft}
              onChange={(e) => setFt(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
            />
            <span className="mt-1 text-[11px] text-slate-400">feet</span>
          </label>
          <label className="flex flex-1 flex-col">
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 10"
              value={inch}
              onChange={(e) => setInch(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
            />
            <span className="mt-1 text-[11px] text-slate-400">inches</span>
          </label>
        </div>

        <div className="mt-4 rounded-lg border-l-4 border-indigo-300 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <strong className="text-slate-700">How this is calculated:</strong>
          <br />• <strong>BMI</strong> = (weight in lbs ÷ (height in inches)²) × 703.
          <br />• <strong>To goal</strong> = current weight − goal weight. Positive means lbs left to lose,
          negative means lbs left to gain.
          <br />• BMI categories shown are the standard CDC bands: &lt;18.5 underweight, 18.5–24.9 normal,
          25–29.9 overweight, 30+ obese. This is a general population metric — it doesn't account for muscle
          mass, so treat it as a rough signal, not a target.
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className={BTN}>
            Cancel
          </button>
          <button onClick={save} className={BTN_PRIMARY}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================ Workouts view (calendar + categories) ============================ */
function WorkoutsView() {
  return (
    <>
      <CalendarSection />
      <CategorySection />
    </>
  )
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}

/* ---------------- Calendar ---------------- */
function CalendarSection() {
  const { doc, mutate, logSession } = useCtx()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [pick, setPick] = useState({ category: '', program: '', workout: '' })
  const calRef = useRef<HTMLDivElement>(null)

  // Click anywhere off the calendar (or press Esc) to hide the open day panel.
  useEffect(() => {
    if (!openDay) return
    const onDown = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setOpenDay(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDay(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openDay])

  const flat = useMemo(() => allWorkoutsFlat(doc), [doc])
  const nameFor = (key: string) => flat.find((f) => f.key === key)?.w.name

  // Which workouts were actually LOGGED (done) on each date, so the calendar can
  // show completed sessions — not just planned/assigned ones. This is what makes
  // "Log Session" show up on the calendar.
  const loggedKeysByDate = useMemo(() => {
    const m: Record<string, Set<string>> = {}
    doc.logs.forEach((l) => {
      ;(m[l.date] ??= new Set<string>()).add(l.workoutKey)
    })
    return m
  }, [doc.logs])

  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function prev() {
    let m = month - 1
    let y = year
    if (m < 0) { m = 11; y-- }
    setMonth(m); setYear(y)
  }
  function next() {
    let m = month + 1
    let y = year
    if (m > 11) { m = 0; y++ }
    setMonth(m); setYear(y)
  }
  function openDayKey(key: string) {
    if (openDay !== key) setPick({ category: '', program: '', workout: '' })
    setOpenDay(key)
  }

  const cells: React.ReactNode[] = []
  for (let i = 0; i < firstDow; i++) cells.push(<div key={`e${i}`} />)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(year, month, d)
    const isToday =
      now.getFullYear() === year && now.getMonth() === month && now.getDate() === d
    const assigned = doc.assignments[key] || []
    const loggedKeys = loggedKeysByDate[key] || new Set<string>()
    const assignedSet = new Set(assigned)
    // Logged workouts that weren't also assigned that day still deserve a marker.
    const extraLogged = [...loggedKeys].filter((k) => !assignedSet.has(k))
    cells.push(
      <button
        key={key}
        onClick={() => openDayKey(key)}
        className={
          'flex min-h-[64px] flex-col gap-1 rounded-lg border p-1.5 text-left transition hover:border-indigo-300 ' +
          (isToday ? 'border-emerald-400 ' : 'border-slate-200 ') +
          (openDay === key ? 'ring-2 ring-indigo-300' : '')
        }
      >
        <span className="text-[11px] text-slate-400">{d}</span>
        {assigned.map((k, i) => {
          const nm = nameFor(k)
          if (!nm) return null
          const done = loggedKeys.has(k) // planned AND logged → show as done
          return (
            <span
              key={`a${i}`}
              className={
                'truncate rounded px-1.5 py-0.5 text-[10.5px] ' +
                (done ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700')
              }
            >
              {done ? '✓ ' : ''}
              {nm}
            </span>
          )
        })}
        {extraLogged.map((k, i) => {
          const nm = nameFor(k)
          return nm ? (
            <span
              key={`l${i}`}
              className="truncate rounded bg-emerald-50 px-1.5 py-0.5 text-[10.5px] text-emerald-700"
            >
              ✓ {nm}
            </span>
          ) : null
        })}
      </button>,
    )
  }

  // cascading picker scope
  const progsInScope = pick.category
    ? doc.categories.find((c) => c.id === pick.category)?.programs || []
    : []
  const workoutsInScope = pick.program
    ? progsInScope.find((p) => p.id === pick.program)?.workouts || []
    : []

  function addToDay() {
    if (!openDay || !pick.category || !pick.program || !pick.workout) return
    const wkey = `${pick.category}::${pick.program}::${pick.workout}`
    mutate((d) => {
      if (!d.assignments[openDay]) d.assignments[openDay] = []
      if (!d.assignments[openDay].includes(wkey)) d.assignments[openDay].push(wkey)
    })
    setPick({ category: '', program: '', workout: '' })
  }
  function removeFromDay(key: string, wkey: string) {
    mutate((d) => {
      d.assignments[key] = (d.assignments[key] || []).filter((x) => x !== wkey)
    })
  }
  // Delete a logged session outright — clears it from the calendar's green ✓
  // marker and from analytics (a log is the "what I actually did" record).
  function removeLog(id: string) {
    if (!confirm('Delete this logged session? It will be removed from the calendar and analytics.')) return
    mutate((d) => {
      d.logs = d.logs.filter((l) => l.id !== id)
    })
  }

  const selectCls = 'rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-300'

  return (
    <div ref={calRef}>
    <Section
      title="Calendar"
      right={
        <div className="flex items-center gap-3">
          <button onClick={prev} className={BTN_SM}>‹ Prev</button>
          <strong className="text-sm">{MONTH_NAMES[month]} {year}</strong>
          <button onClick={next} className={BTN_SM}>Next ›</button>
        </div>
      }
    >
      <div className="grid grid-cols-7 gap-1.5">
        {DOW.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] text-slate-400">{d}</div>
        ))}
        {cells}
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
        <span>
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">Planned</span> = added to calendar
        </span>
        <span>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">✓ Done</span> = logged session
        </span>
      </div>

      {openDay && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h4 className="mb-2 text-sm font-semibold">{openDay} — assigned workouts</h4>
          <div className="mb-3 flex flex-col gap-1.5">
            {(doc.assignments[openDay] || []).length === 0 ? (
              <div className="text-xs italic text-slate-400">Nothing assigned yet.</div>
            ) : (
              (doc.assignments[openDay] || []).map((k) => {
                const f = flat.find((x) => x.key === k)
                return f ? (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
                  >
                    <span>{f.label}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => logSession(k, openDay)}
                        className={BTN_SM}
                        title="Snapshot the current reps/weight for analytics"
                      >
                        Log Results
                      </button>
                      <button onClick={() => removeFromDay(openDay, k)} className={BTN_SM}>
                        Remove
                      </button>
                    </div>
                  </div>
                ) : null
              })
            )}
          </div>

          {doc.logs.some((l) => l.date === openDay) && (
            <div className="mb-3">
              <div className="mb-1 text-xs font-medium text-emerald-700">✓ Logged this day</div>
              <div className="flex flex-col gap-1.5">
                {doc.logs
                  .filter((l) => l.date === openDay)
                  .map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800"
                    >
                      <span>{l.categoryName} › {l.programName} › {l.workoutName}</span>
                      <button
                        onClick={() => removeLog(l.id)}
                        className={BTN_SM}
                        title="Delete this logged session (removes it from the calendar and analytics)"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="mb-1 text-xs text-slate-500">Assign an existing workout</div>
          <div className="mb-2 flex flex-wrap gap-2">
            <select
              value={pick.category}
              onChange={(e) => setPick({ category: e.target.value, program: '', workout: '' })}
              className={selectCls}
            >
              <option value="">1. Choose a category…</option>
              {doc.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={pick.program}
              disabled={!pick.category}
              onChange={(e) => setPick((p) => ({ ...p, program: e.target.value, workout: '' }))}
              className={selectCls}
            >
              <option value="">2. Choose a program…</option>
              {progsInScope.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={pick.workout}
              disabled={!pick.program}
              onChange={(e) => setPick((p) => ({ ...p, workout: e.target.value }))}
              className={selectCls}
            >
              <option value="">3. Choose a workout…</option>
              {workoutsInScope.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={addToDay} disabled={!pick.workout} className={BTN_PRIMARY_SM}>
              Add to this day
            </button>
            <button onClick={() => { setOpenDay(null); setPick({ category: '', program: '', workout: '' }) }} className={BTN_SM}>
              Close
            </button>
          </div>
        </div>
      )}
    </Section>
    </div>
  )
}

/* ---------------- Category tabs + programs ---------------- */
function CategorySection() {
  const { doc, mutate } = useCtx()
  const active = doc.categories.find((c) => c.id === doc.activeCategory) || doc.categories[0]

  // multi-select (batch move) state, scoped to one program at a time
  const [selectProgId, setSelectProgId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // collapse state
  const [collapsedProgs, setCollapsedProgs] = useState<Set<string>>(new Set())
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set())

  function addCategory() {
    const name = prompt('New category name (e.g. Yoga, Swimming):')
    if (!name) return
    const id = uid('cat')
    mutate((d) => {
      d.categories.push({ id, name, programs: [] })
      d.activeCategory = id
    })
  }
  function setActive(id: string) {
    mutate((d) => { d.activeCategory = id })
  }
  function addProgram() {
    if (!active) return
    const name = prompt('New program name (e.g. Body Beast, 5x5, Couch to 5K):')
    if (!name) return
    mutate((d) => {
      const c = d.categories.find((x) => x.id === active.id)
      if (c) c.programs.push({ id: uid('prog'), name, workouts: [] })
    })
  }

  function toggleSelectMode(progId: string) {
    if (selectProgId === progId) {
      setSelectProgId(null)
      setSelectedIds(new Set())
    } else {
      setSelectProgId(progId)
      setSelectedIds(new Set())
    }
  }

  return (
    <Section title="Programs">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {doc.categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            className={
              'rounded-full border px-4 py-1.5 text-sm transition ' +
              (c.id === (active && active.id)
                ? 'border-indigo-300 bg-indigo-50 font-semibold text-indigo-700'
                : 'border-slate-300 text-slate-500 hover:bg-slate-100')
            }
          >
            {c.name}
          </button>
        ))}
        <button onClick={addCategory} className={BTN_SM}>+ Add Category</button>
      </div>

      {active && (
        <>
          {active.programs.length === 0 && (
            <p className="mb-3 text-sm text-slate-400">No programs in this category yet.</p>
          )}
          {active.programs.map((prog) => (
            <ProgramCard
              key={prog.id}
              catId={active.id}
              progId={prog.id}
              collapsed={collapsedProgs.has(prog.id)}
              onToggleCollapse={() =>
                setCollapsedProgs((s) => {
                  const n = new Set(s)
                  n.has(prog.id) ? n.delete(prog.id) : n.add(prog.id)
                  return n
                })
              }
              selecting={selectProgId === prog.id}
              onToggleSelectMode={() => toggleSelectMode(prog.id)}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onDoneSelecting={() => { setSelectProgId(null); setSelectedIds(new Set()) }}
              expandedWorkouts={expandedWorkouts}
              setExpandedWorkouts={setExpandedWorkouts}
            />
          ))}
          <button onClick={addProgram} className={BTN_PRIMARY + ' mt-2'}>+ Add Program</button>
        </>
      )}
    </Section>
  )
}

function ProgramCard({
  catId,
  progId,
  collapsed,
  onToggleCollapse,
  selecting,
  onToggleSelectMode,
  selectedIds,
  setSelectedIds,
  onDoneSelecting,
  expandedWorkouts,
  setExpandedWorkouts,
}: {
  catId: string
  progId: string
  collapsed: boolean
  onToggleCollapse: () => void
  selecting: boolean
  onToggleSelectMode: () => void
  selectedIds: Set<string>
  setSelectedIds: (fn: (s: Set<string>) => Set<string>) => void
  onDoneSelecting: () => void
  expandedWorkouts: Set<string>
  setExpandedWorkouts: (fn: (s: Set<string>) => Set<string>) => void
}) {
  const { doc, mutate } = useCtx()
  const cat = doc.categories.find((c) => c.id === catId)
  const prog = cat?.programs.find((p) => p.id === progId)
  const [moveOpen, setMoveOpen] = useState(false)
  if (!cat || !prog) return null

  function renameProgram(name: string) {
    mutate((d) => {
      const p = d.categories.find((c) => c.id === catId)?.programs.find((x) => x.id === progId)
      if (p) p.name = name
    })
  }
  function deleteProgram() {
    if (!prog) return
    if (!confirm(`Delete program "${prog.name}" and all its workouts?`)) return
    mutate((d) => {
      const c = d.categories.find((x) => x.id === catId)
      if (c) c.programs = c.programs.filter((p) => p.id !== progId)
    })
  }
  function addWorkout() {
    const name = prompt('New workout name (e.g. Build: Legs):')
    if (!name) return
    mutate((d) => {
      const p = d.categories.find((c) => c.id === catId)?.programs.find((x) => x.id === progId)
      if (p) {
        p.workouts.push({
          id: uid('workout'),
          name,
          equipment: [],
          weightSuggestions: '',
          notes: '',
          weeks: ['Set 1'],
          groups: [{ type: 'Single Set', exercises: [{ name: 'New Exercise', cells: [{ reps: '', weight: '' }] }] }],
        })
      }
    })
  }

  function toggleId(id: string) {
    setSelectedIds((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  const chosen = prog.workouts.filter((w) => selectedIds.has(w.id))

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={onToggleCollapse} className="text-slate-400" title="Expand / collapse">
            <span className={'inline-block transition ' + (collapsed ? '-rotate-90' : '')}>▾</span>
          </button>
          <EditableInput
            value={prog.name}
            onCommit={renameProgram}
            className="rounded bg-transparent px-1 py-0.5 text-[15px] font-semibold hover:bg-white focus:bg-white focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onToggleSelectMode} className={BTN_SM}>
            {selecting ? 'Done selecting' : 'Select'}
          </button>
          <button onClick={addWorkout} className={BTN_SM}>+ Workout</button>
          <button onClick={deleteProgram} className={BTN_DANGER_SM}>Delete</button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4">
          {selecting && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-2.5 text-sm">
              <span className="font-semibold text-indigo-900">{selectedIds.size} selected</span>
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedIds(() => new Set(prog.workouts.map((w) => w.id)))}
                  className={BTN_SM}
                >
                  Select all
                </button>
                <button onClick={() => setSelectedIds(() => new Set())} className={BTN_SM}>Clear</button>
                <button
                  onClick={() => setMoveOpen(true)}
                  disabled={selectedIds.size === 0}
                  className={BTN_PRIMARY_SM}
                >
                  Move selected…
                </button>
              </div>
              {moveOpen && (
                <div className="w-full">
                  <MovePanel
                    fromCatId={catId}
                    fromProgId={progId}
                    workoutIds={chosen.map((w) => w.id)}
                    heading={`Move ${chosen.length} workout${chosen.length > 1 ? 's' : ''}`}
                    subtitle={chosen.map((w) => w.name).join(', ')}
                    onClose={() => setMoveOpen(false)}
                    onMoved={() => { setMoveOpen(false); onDoneSelecting() }}
                  />
                </div>
              )}
            </div>
          )}

          {prog.workouts.length === 0 && (
            <p className="text-sm text-slate-400">No workouts yet — use “+ Workout”.</p>
          )}
          {prog.workouts.map((w) => (
            <WorkoutCard
              key={w.id}
              catId={catId}
              progId={progId}
              workoutId={w.id}
              expanded={expandedWorkouts.has(w.id)}
              onToggleExpand={() =>
                setExpandedWorkouts((s) => {
                  const n = new Set(s)
                  n.has(w.id) ? n.delete(w.id) : n.add(w.id)
                  return n
                })
              }
              selecting={selecting}
              selected={selectedIds.has(w.id)}
              onToggleSelect={() => toggleId(w.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- Workout card ---------------- */
function WorkoutCard({
  catId,
  progId,
  workoutId,
  expanded,
  onToggleExpand,
  selecting,
  selected,
  onToggleSelect,
}: {
  catId: string
  progId: string
  workoutId: string
  expanded: boolean
  onToggleExpand: () => void
  selecting: boolean
  selected: boolean
  onToggleSelect: () => void
}) {
  const { doc, mutate, logSession } = useCtx()
  const w = findWorkout(doc, catId, progId, workoutId)
  const workoutKey = `${catId}::${progId}::${workoutId}`
  const logCount = doc.logs.filter((l) => l.workoutKey === workoutKey).length

  const [panel, setPanel] = useState<'assign' | 'log' | 'move' | null>(null)
  const [comparing, setComparing] = useState(false)
  const [compareLogId, setCompareLogId] = useState<string | null>(null)

  if (!w) return null

  function rename(name: string) {
    mutate((d) => {
      const t = findWorkout(d, catId, progId, workoutId)
      if (t) t.name = name
    })
  }
  function del() {
    if (!confirm(`Delete workout "${w!.name}"?`)) return
    mutate((d) => {
      const p = d.categories.find((c) => c.id === catId)?.programs.find((x) => x.id === progId)
      if (p) p.workouts = p.workouts.filter((x) => x.id !== workoutId)
    })
  }

  const logs = doc.logs
    .filter((l) => l.workoutKey === workoutKey)
    .sort((a, b) => b.date.localeCompare(a.date))
  const compareLog = compareLogId ? logs.find((l) => l.id === compareLogId) || null : null

  return (
    <div className="my-2.5 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          {selecting && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="h-4 w-4 accent-indigo-600"
              title="Select this workout to move"
            />
          )}
          <button onClick={onToggleExpand} className="text-slate-400" title="Expand / collapse">
            <span className={'inline-block transition ' + (expanded ? '' : '-rotate-90')}>▾</span>
          </button>
          <EditableInput
            value={w.name}
            onCommit={rename}
            className="rounded bg-transparent px-1 py-0.5 text-[15px] font-semibold hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
          />
          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-emerald-600">
            {logCount} logged
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <input
              type="checkbox"
              checked={comparing}
              onChange={(e) => {
                setComparing(e.target.checked)
                if (!e.target.checked) setCompareLogId(null)
              }}
              className="h-3.5 w-3.5 accent-emerald-500"
            />
            Compare to a day
          </label>
          <button onClick={() => setPanel(panel === 'log' ? null : 'log')} className={BTN_SM}>Log Session</button>
          <button onClick={() => setPanel(panel === 'assign' ? null : 'assign')} className={BTN_SM}>Add to Calendar</button>
          <button onClick={() => setPanel(panel === 'move' ? null : 'move')} className={BTN_SM}>Move</button>
          <button onClick={del} className={BTN_DANGER_SM}>Delete</button>
        </div>
      </div>

      {panel === 'log' && (
        <div className="border-t border-slate-100 px-3 py-2.5">
          <DatePickPanel
            title="Log a session"
            confirmLabel="Log this date"
            onConfirm={(date) => { logSession(workoutKey, date); setPanel(null) }}
            onClose={() => setPanel(null)}
          />
        </div>
      )}
      {panel === 'assign' && (
        <div className="border-t border-slate-100 px-3 py-2.5">
          <DatePickPanel
            title="Assign to a date"
            confirmLabel="Add"
            onConfirm={(date) => {
              mutate((d) => {
                if (!d.assignments[date]) d.assignments[date] = []
                if (!d.assignments[date].includes(workoutKey)) d.assignments[date].push(workoutKey)
              })
              setPanel(null)
            }}
            onClose={() => setPanel(null)}
          />
        </div>
      )}
      {panel === 'move' && (
        <div className="border-t border-slate-100 px-3 py-2.5">
          <MovePanel
            fromCatId={catId}
            fromProgId={progId}
            workoutIds={[workoutId]}
            heading={`Move "${w.name}"`}
            onClose={() => setPanel(null)}
            onMoved={() => setPanel(null)}
          />
        </div>
      )}

      {comparing && !compareLog && (
        <div className="border-t border-slate-100 px-3 py-2.5">
          <div className="mb-1.5 text-xs font-semibold text-slate-600">Compare to a day</div>
          {logs.length === 0 ? (
            <div className="text-xs italic text-slate-400">No sessions logged yet for this workout.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {logs.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setCompareLogId(l.id)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs hover:border-indigo-300"
                >
                  {l.date}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {comparing && compareLog && (
        <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-emerald-600">
          Comparing to {compareLog.date}
          <button onClick={() => setCompareLogId(null)} className={BTN_SM}>Pick another</button>
          <button onClick={() => { setComparing(false); setCompareLogId(null) }} className={BTN_SM}>Clear</button>
        </div>
      )}

      {expanded && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
          <Worksheet catId={catId} progId={progId} workoutId={workoutId} compareLog={compareLog} />
        </div>
      )}
    </div>
  )
}

function DatePickPanel({
  title,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string
  confirmLabel: string
  onConfirm: (date: string) => void
  onClose: () => void
}) {
  const [date, setDate] = useState(todayKey())
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-slate-600">{title}</div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button onClick={() => date && onConfirm(date)} className={BTN_PRIMARY_SM}>{confirmLabel}</button>
        <button onClick={onClose} className={BTN_SM}>Cancel</button>
      </div>
    </div>
  )
}

/* ---------------- Move panel (single + batch) ---------------- */
function MovePanel({
  fromCatId,
  fromProgId,
  workoutIds,
  heading,
  subtitle,
  onClose,
  onMoved,
}: {
  fromCatId: string
  fromProgId: string
  workoutIds: string[]
  heading: string
  subtitle?: string
  onClose: () => void
  onMoved: () => void
}) {
  const { doc, moveWorkouts, createProgram } = useCtx()
  const [catId, setCatId] = useState(fromCatId)
  const [progId, setProgId] = useState(fromProgId)

  const progs = doc.categories.find((c) => c.id === catId)?.programs || []
  // If the chosen category has no program matching progId, fall back to first.
  const effectiveProg = progs.find((p) => p.id === progId)?.id || progs[0]?.id || ''

  const selectCls = 'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm'

  function newProgram() {
    const name = prompt('New program name:')
    if (!name) return
    const id = createProgram(catId, name)
    setProgId(id)
  }
  function confirmMove() {
    const target = progs.find((p) => p.id === progId)?.id || effectiveProg
    if (!catId || !target) return
    moveWorkouts(fromCatId, fromProgId, workoutIds, catId, target)
    onMoved()
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{heading}</h4>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
      </div>
      {subtitle && <div className="mb-2 text-[11.5px] leading-snug text-slate-500">{subtitle}</div>}
      <div className="flex flex-col gap-2 sm:max-w-xs">
        <select
          value={catId}
          onChange={(e) => { setCatId(e.target.value); setProgId('') }}
          className={selectCls}
        >
          {doc.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={effectiveProg} onChange={(e) => setProgId(e.target.value)} className={selectCls}>
          {progs.length === 0 && <option value="">No programs — create one below</option>}
          {progs.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button onClick={newProgram} className={BTN_SM}>+ Create new program here</button>
        <button onClick={confirmMove} disabled={!effectiveProg} className={BTN_PRIMARY_SM}>
          {`Move ${workoutIds.length} workout${workoutIds.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

/* ---------------- Worksheet ---------------- */
function Worksheet({
  catId,
  progId,
  workoutId,
  compareLog,
}: {
  catId: string
  progId: string
  workoutId: string
  compareLog: WorkoutLog | null
}) {
  const { doc, mutate } = useCtx()
  const w = findWorkout(doc, catId, progId, workoutId)
  if (!w) return null

  const edit = (fn: (t: Workout) => void) =>
    mutate((d) => {
      const t = findWorkout(d, catId, progId, workoutId)
      if (t) fn(t)
    })

  const pastFlat = compareLog ? flattenExercises(compareLog.groups) : null

  function setCell(gi: number, ei: number, ci: number, field: 'reps' | 'weight', value: string) {
    edit((t) => { t.groups[gi].exercises[ei].cells[ci][field] = value })
  }
  function setExName(gi: number, ei: number, value: string) {
    edit((t) => { t.groups[gi].exercises[ei].name = value })
  }
  function setGroupType(gi: number, value: string) {
    edit((t) => { t.groups[gi].type = value })
  }
  function delExercise(gi: number, ei: number) {
    edit((t) => {
      t.groups[gi].exercises.splice(ei, 1)
      if (t.groups[gi].exercises.length === 0) t.groups.splice(gi, 1)
    })
  }
  function delColumn(idx: number) {
    edit((t) => {
      t.weeks.splice(idx, 1)
      t.groups.forEach((g) => g.exercises.forEach((ex) => ex.cells.splice(idx, 1)))
    })
  }
  function addColumn() {
    edit((t) => {
      t.weeks.push(`Set ${t.weeks.length + 1}`)
      t.groups.forEach((g) => g.exercises.forEach((ex) => ex.cells.push({ reps: '', weight: '' })))
    })
  }
  function addGroup(type: string) {
    edit((t) => {
      t.groups.push({ type, exercises: [{ name: 'New Exercise', cells: t.weeks.map(() => ({ reps: '', weight: '' })) }] })
    })
  }
  function addCustomGroup() {
    const type = prompt('Name this set type (e.g. Drop Set, Circuit, Tri-Set):')
    if (!type) return
    addGroup(type)
  }
  function addExerciseToLast() {
    edit((t) => {
      if (t.groups.length === 0) t.groups.push({ type: 'Single Set', exercises: [] })
      t.groups[t.groups.length - 1].exercises.push({
        name: 'New Exercise',
        cells: t.weeks.map(() => ({ reps: '', weight: '' })),
      })
    })
  }
  function commitEquipment(v: string) {
    edit((t) => { t.equipment = v.split(',').map((s) => s.trim()).filter(Boolean) })
  }

  const repInputCls = 'w-11 rounded bg-transparent px-1 py-0.5 text-xs text-slate-500 focus:bg-slate-100 focus:outline-none'
  const wInputCls = 'w-14 rounded bg-transparent px-1 py-0.5 text-xs focus:bg-slate-100 focus:outline-none'

  let flatIdx = 0

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Set Type</th>
              <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Exercise</th>
              {w.weeks.map((wk, i) => (
                <th key={i} className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span className="flex items-center gap-1">
                    {wk}
                    <button onClick={() => delColumn(i)} className="text-slate-400 hover:text-money-out" title="Remove set column">✕</button>
                  </span>
                </th>
              ))}
              <th className="border border-slate-200 bg-slate-50 px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {w.groups.map((g, gi) =>
              g.exercises.map((ex, ei) => {
                const pastEx = pastFlat ? pastFlat.find((p) => p.name === ex.name) || pastFlat[flatIdx] : null
                flatIdx++
                return (
                  <tr key={`${gi}-${ei}`}>
                    <td className="whitespace-nowrap border border-slate-200 px-2 py-1 align-middle">
                      {ei === 0 && (
                        <EditableInput
                          value={g.type}
                          onCommit={(v) => setGroupType(gi, v)}
                          className="w-full rounded bg-transparent px-1 py-0.5 text-xs font-semibold text-emerald-600 focus:bg-slate-100 focus:outline-none"
                        />
                      )}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 align-middle">
                      <EditableInput
                        value={ex.name}
                        onCommit={(v) => setExName(gi, ei, v)}
                        className="w-full min-w-[9rem] rounded bg-transparent px-1 py-0.5 text-xs focus:bg-slate-100 focus:outline-none"
                      />
                    </td>
                    {ex.cells.map((c, ci) => {
                      const pastCell = pastEx ? pastEx.cells[ci] : null
                      return (
                        <td key={ci} className="border border-slate-200 px-2 py-1 align-top">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-400">R</span>
                            <EditableInput value={c.reps} onCommit={(v) => setCell(gi, ei, ci, 'reps', v)} className={repInputCls} />
                            <span className="text-[11px] text-slate-400">W</span>
                            <EditableInput value={c.weight} onCommit={(v) => setCell(gi, ei, ci, 'weight', v)} className={wInputCls} />
                          </div>
                          {pastCell && (
                            <div className="mt-0.5 text-[10.5px] text-emerald-600">
                              {compareLog!.date}: {pastCell.reps || '-'} reps @ {pastCell.weight || '-'}
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td className="whitespace-nowrap border border-slate-200 px-2 py-1 align-middle">
                      <button onClick={() => delExercise(gi, ei)} className="text-xs text-slate-400 hover:text-money-out">✕ row</button>
                    </td>
                  </tr>
                )
              }),
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2">
        <button onClick={addExerciseToLast} className={BTN_SM}>+ Add Exercise to last set group</button>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Sets (columns)</div>
        <button onClick={addColumn} className={BTN_SM}>+ Add Set Column</button>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Set Groups (rows)</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => addGroup('Single Set')} className={BTN_SM}>+ Single Set</button>
          <button onClick={() => addGroup('Super Set')} className={BTN_SM}>+ Super Set</button>
          <button onClick={() => addGroup('Giant Set')} className={BTN_SM}>+ Giant Set</button>
          <button onClick={addCustomGroup} className={BTN_SM}>+ Custom Set Type…</button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col">
          <span className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Equipment (comma separated)</span>
          <EditableInput
            value={w.equipment.join(', ')}
            onCommit={commitEquipment}
            placeholder="— click to add —"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-slate-400"
          />
        </label>
        <label className="flex flex-col">
          <span className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Weight Suggestions</span>
          <EditableInput
            value={w.weightSuggestions}
            onCommit={(v) => edit((t) => { t.weightSuggestions = v })}
            placeholder="— click to add —"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-slate-400"
          />
        </label>
      </div>
      <label className="mt-3 flex flex-col">
        <span className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Notes</span>
        <EditableTextarea value={w.notes} onCommit={(v) => edit((t) => { t.notes = v })} />
      </label>
    </div>
  )
}

/* ============================ Analytics ============================ */
interface AnalyticsFilters {
  category: string
  program: string
  workout: string
  range: string
  exercise: string
}
function getFilteredLogs(doc: WorkoutDoc, f: AnalyticsFilters): WorkoutLog[] {
  let logs = doc.logs.filter((l) => {
    const [cId, pId, wId] = l.workoutKey.split('::')
    if (f.category && cId !== f.category) return false
    if (f.program && pId !== f.program) return false
    if (f.workout && wId !== f.workout) return false
    return true
  })
  if (f.range !== 'all') {
    const days = parseInt(f.range, 10)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = dateKey(cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate())
    logs = logs.filter((l) => l.date >= cutoffStr)
  }
  return logs.slice().sort((a, b) => a.date.localeCompare(b.date))
}

function AnalyticsView() {
  const { doc } = useCtx()
  const [f, setF] = useState<AnalyticsFilters>({ category: '', program: '', workout: '', range: 'all', exercise: '' })

  const progsInScope = f.category
    ? doc.categories.find((c) => c.id === f.category)?.programs || []
    : doc.categories.flatMap((c) => c.programs)
  const workoutsInScope = f.program
    ? progsInScope.find((p) => p.id === f.program)?.workouts || []
    : progsInScope.flatMap((p) => p.workouts)

  const logs = getFilteredLogs(doc, f)

  const exerciseNames = useMemo(
    () => Array.from(new Set(logs.flatMap((l) => flattenExercises(l.groups).map((e) => e.name)))),
    [logs],
  )
  const exercise = f.exercise && exerciseNames.includes(f.exercise) ? f.exercise : exerciseNames[0] || ''

  const selectCls = 'min-w-[160px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm'

  const trendData = logs
    .map((l) => {
      const ex = flattenExercises(l.groups).find((e) => e.name === exercise)
      const weight = ex ? lastNumericWeight(ex.cells) : null
      return { date: l.date, label: l.date.slice(5), weight }
    })
    .filter((p): p is { date: string; label: string; weight: number } => p.weight != null)

  let stats: { count: number; first: string; last: string; perWeek: string } | null = null
  if (logs.length) {
    const first = logs[0].date
    const last = logs[logs.length - 1].date
    const spanDays = Math.max(1, (new Date(last).getTime() - new Date(first).getTime()) / 86400000)
    stats = { count: logs.length, first, last, perWeek: (logs.length / (spanDays / 7)).toFixed(1) }
  }

  return (
    <Section title="Analytics">
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={f.category}
          onChange={(e) => setF((p) => ({ ...p, category: e.target.value, program: '', workout: '' }))}
          className={selectCls}
        >
          <option value="">All categories</option>
          {doc.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={f.program}
          onChange={(e) => setF((p) => ({ ...p, program: e.target.value, workout: '' }))}
          className={selectCls}
        >
          <option value="">All programs</option>
          {progsInScope.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={f.workout}
          onChange={(e) => setF((p) => ({ ...p, workout: e.target.value }))}
          className={selectCls}
        >
          <option value="">All workouts</option>
          {workoutsInScope.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select value={f.range} onChange={(e) => setF((p) => ({ ...p, range: e.target.value }))} className={selectCls}>
          <option value="all">All time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {!logs.length || !stats ? (
        <div className="text-sm italic text-slate-400">
          No logged sessions match these filters yet. Open a calendar day with a workout assigned and click
          “Log Results”, or use “Log Session” on a workout card.
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Kpi label="Sessions Logged" value={String(stats.count)} />
            <Kpi label="Date Range" value={`${stats.first} → ${stats.last}`} />
            <Kpi label="Avg / Week" value={stats.perWeek} />
          </div>

          <div className="mb-5 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date</th>
                  <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Workout</th>
                  <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500"># Exercises</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice().reverse().map((l) => (
                  <tr key={l.id}>
                    <td className="border border-slate-200 px-2 py-1">{l.date}</td>
                    <td className="border border-slate-200 px-2 py-1">{l.categoryName} › {l.programName} › {l.workoutName}</td>
                    <td className="border border-slate-200 px-2 py-1">{flattenExercises(l.groups).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="mb-2 text-sm font-semibold text-slate-600">Exercise trend (weight over logged sessions)</h4>
          <select
            value={exercise}
            onChange={(e) => setF((p) => ({ ...p, exercise: e.target.value }))}
            className={selectCls + ' mb-3'}
          >
            {exerciseNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          {trendData.length === 0 ? (
            <div className="text-sm italic text-slate-400">No numeric weight logged for this exercise yet.</div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} width={40} />
                  <Tooltip
                    formatter={(v: number) => [`${v} lbs`, 'Weight']}
                    labelFormatter={(_l, payload) => (payload && payload[0] ? payload[0].payload.date : '')}
                  />
                  <Bar dataKey="weight" name="Weight" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </Section>
  )
}

/* ============================ Logs view ============================ */
function LogsView() {
  const { doc, mutate } = useCtx()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const logs = doc.logs.slice().sort((a, b) => b.date.localeCompare(a.date))

  function delLog(id: string) {
    const log = logs.find((x) => x.id === id)
    if (!log) return
    if (!confirm(`Delete the logged session for "${log.workoutName}" on ${log.date}?`)) return
    mutate((d) => { d.logs = d.logs.filter((x) => x.id !== id) })
  }

  return (
    <Section title="Logged Sessions">
      {logs.length === 0 ? (
        <div className="text-sm italic text-slate-400">
          No sessions logged yet. Use “Log Session” on any workout card, or “Log Results” from a calendar day.
        </div>
      ) : (
        logs.map((l) => {
          const open = expanded.has(l.id)
          return (
            <div key={l.id} className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() =>
                    setExpanded((s) => {
                      const n = new Set(s)
                      n.has(l.id) ? n.delete(l.id) : n.add(l.id)
                      return n
                    })
                  }
                  className="flex items-center gap-2 text-left"
                >
                  <span className={'inline-block text-slate-400 transition ' + (open ? '' : '-rotate-90')}>▾</span>
                  <strong>{l.date}</strong>
                  <span className="text-xs text-slate-500">
                    {l.categoryName} › {l.programName} › {l.workoutName}
                  </span>
                </button>
                <button onClick={() => delLog(l.id)} className={BTN_DANGER_SM}>Delete</button>
              </div>
              {open && (
                <div className="px-4 pb-4">
                  <LogTable log={l} />
                </div>
              )}
            </div>
          )
        })
      )}
    </Section>
  )
}

function LogTable({ log }: { log: WorkoutLog }) {
  const { mutate } = useCtx()

  function setCell(gi: number, ei: number, ci: number, field: 'reps' | 'weight', value: string) {
    mutate((d) => {
      const t = d.logs.find((x) => x.id === log.id)
      if (t) t.groups[gi].exercises[ei].cells[ci][field] = value
    })
  }
  const repInputCls = 'w-11 rounded bg-transparent px-1 py-0.5 text-xs text-slate-500 focus:bg-slate-100 focus:outline-none'
  const wInputCls = 'w-14 rounded bg-transparent px-1 py-0.5 text-xs focus:bg-slate-100 focus:outline-none'

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-slate-200 bg-white px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Set Type</th>
            <th className="border border-slate-200 bg-white px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Exercise</th>
            {log.weeks.map((wk, i) => (
              <th key={i} className="border border-slate-200 bg-white px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">{wk}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {log.groups.map((g, gi) =>
            g.exercises.map((ex, ei) => (
              <tr key={`${gi}-${ei}`}>
                <td className="whitespace-nowrap border border-slate-200 px-2 py-1 font-semibold text-emerald-600">{ei === 0 ? g.type : ''}</td>
                <td className="border border-slate-200 px-2 py-1">{ex.name}</td>
                {ex.cells.map((c, ci) => (
                  <td key={ci} className="border border-slate-200 px-2 py-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-400">R</span>
                      <EditableInput value={c.reps} onCommit={(v) => setCell(gi, ei, ci, 'reps', v)} className={repInputCls} />
                      <span className="text-[11px] text-slate-400">W</span>
                      <EditableInput value={c.weight} onCommit={(v) => setCell(gi, ei, ci, 'weight', v)} className={wInputCls} />
                    </div>
                  </td>
                ))}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  )
}
