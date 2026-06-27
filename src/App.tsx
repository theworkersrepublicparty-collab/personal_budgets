import { Link, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import BudgetView from './pages/BudgetView'

export default function App() {
  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold">
            <span>💰</span>
            <span>Personal Budgets</span>
          </Link>
          <span className="text-xs text-slate-400">local-only · your data stays on this machine</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/budget/:id" element={<BudgetView />} />
        </Routes>
      </main>
    </div>
  )
}
