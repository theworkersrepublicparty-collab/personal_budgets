// Creates the two starter budget instances on first run so the app isn't empty.
// They are just normal instances of the generic engine — you can rename or
// delete them, and create more via the "New budget" flow.
import { db } from './db.ts'
import type { BudgetConfig } from '../shared/types.ts'

export function seedIfEmpty(): void {
  const row = db.prepare('SELECT COUNT(*) AS n FROM budgets').get() as { n: number }
  if (row.n > 0) return

  const livingConfig: BudgetConfig = { currency: 'USD' }
  const businessConfig: BudgetConfig = { currency: 'USD' }

  const insert = db.prepare('INSERT INTO budgets (name, type, config) VALUES (?, ?, ?)')
  insert.run('Day-to-Day Living', 'living', JSON.stringify(livingConfig))
  insert.run('Website / Business', 'business', JSON.stringify(businessConfig))
  console.log('  Seeded starter budgets: Day-to-Day Living, Website / Business')
}
