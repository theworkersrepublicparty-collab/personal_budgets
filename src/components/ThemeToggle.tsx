import { useEffect, useState } from 'react'

// Light/dark switch. The actual theme lives as a `.dark` class on <html>
// (see src/index.css for the colors and index.html for the no-flash startup
// script). This just flips that class and remembers the choice in the browser's
// localStorage — the right place for a per-device UI preference like this.
type Theme = 'light' | 'dark'

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  // Keep the <html> class + saved preference in sync with our state.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* ignore private-mode storage errors */
    }
  }, [theme])

  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      onClick={() => setTheme(next)}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100"
    >
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  )
}
