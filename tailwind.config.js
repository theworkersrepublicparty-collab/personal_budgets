/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
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
