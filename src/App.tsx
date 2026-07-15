import { useEffect, useRef, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import BackupRestore from './components/BackupRestore'
import ThemeToggle from './components/ThemeToggle'
import Home from './pages/Home'
import BudgetView from './pages/BudgetView'
import Planner from './pages/Planner'
import Rental from './pages/Rental'
import Properties from './pages/Properties'
import PropertyView from './pages/PropertyView'
import Recipes from './pages/Recipes'
import RecipeView from './pages/RecipeView'
import Workouts from './pages/Workouts'

// The navigation, defined once as data and rendered two ways: inline tabs on a
// wide screen, and a grouped hamburger menu on phones/narrow windows. Grouping
// keeps the phone menu tidy — related screens sit under one heading.
interface NavItem {
  label: string
  to: string
  icon: string
}
interface NavGroup {
  label: string
  icon: string
  items: NavItem[]
}
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Budgets',
    icon: '🧮',
    items: [
      { label: 'Budgets', to: '/', icon: '🧮' },
      { label: 'Yearly Planner', to: '/planner', icon: '📅' },
    ],
  },
  {
    label: 'Real Estate',
    icon: '🏠',
    items: [
      { label: 'Properties', to: '/properties', icon: '🏠' },
      { label: 'Deal Estimator', to: '/rental', icon: '🧮' },
    ],
  },
  {
    label: 'Health',
    icon: '💪',
    items: [
      { label: 'Food Recipes', to: '/recipes', icon: '🍽️' },
      { label: 'Workouts', to: '/workouts', icon: '🏋️' },
    ],
  },
]

// Home ('/') must match exactly; the others match their section (so a detail
// page like /properties/3 still highlights "Properties").
function isActive(pathname: string, to: string): boolean {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/')
}

export default function App() {
  const [backupOpen, setBackupOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the phone menu whenever you navigate to a new page.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Close it on an outside click or the Esc key.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold">
            <span>💰</span>
            <span>Personal Budgets</span>
          </Link>

          {/* The grouped hamburger menu is the nav at every screen size. */}
          <div className="flex items-center gap-2" ref={menuRef}>
            <ThemeToggle />
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-label="Menu"
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                <span className="text-base leading-none">☰</span> Menu
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  {NAV_GROUPS.map((group) => (
                    <div key={group.label} className="border-b border-slate-100 py-1.5 last:border-b-0">
                      <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {group.icon} {group.label}
                      </div>
                      {group.items.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          className={
                            'block px-4 py-2 text-sm ' +
                            (isActive(location.pathname, item.to)
                              ? 'bg-indigo-50 font-semibold text-indigo-700'
                              : 'text-slate-600 hover:bg-slate-100')
                          }
                        >
                          <span className="mr-2">{item.icon}</span>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ))}
                  <div className="py-1.5">
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        setBackupOpen(true)
                      }}
                      className="block w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
                    >
                      💾 Backup &amp; Restore
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {backupOpen && <BackupRestore onClose={() => setBackupOpen(false)} />}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/budget/:id" element={<BudgetView />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/properties/:id" element={<PropertyView />} />
          <Route path="/rental" element={<Rental />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/recipes/:id" element={<RecipeView />} />
          <Route path="/workouts" element={<Workouts />} />
        </Routes>
      </main>
    </div>
  )
}
