import { Link, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import BudgetView from './pages/BudgetView'
import Planner from './pages/Planner'
import Rental from './pages/Rental'
import Properties from './pages/Properties'
import PropertyView from './pages/PropertyView'

export default function App() {
  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold">
            <span>💰</span>
            <span>Personal Budgets</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-slate-500 hover:text-ink">
              Budgets
            </Link>
            <Link to="/planner" className="text-slate-500 hover:text-ink">
              📅 Planner
            </Link>
            <Link to="/properties" className="text-slate-500 hover:text-ink">
              🏠 Properties
            </Link>
            <Link to="/rental" className="text-slate-500 hover:text-ink">
              🧮 Deal Estimator
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/budget/:id" element={<BudgetView />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/properties/:id" element={<PropertyView />} />
          <Route path="/rental" element={<Rental />} />
        </Routes>
      </main>
    </div>
  )
}
