/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // 'class' = dark mode turns on when a `.dark` class is present on <html>.
  // A tiny script in index.html sets that class before the page paints, and the
  // header toggle flips it. See src/index.css for the actual dark colors.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        money: {
          in: '#16a34a',
          out: '#dc2626',
        },
      },
    },
  },
  plugins: [],
}
