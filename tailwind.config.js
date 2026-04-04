/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./app.js",
    "./screens/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        f1: {
          red: '#e10600',
          'red-soft': '#ff3b30',
          orange: '#ec4e02',
          black: '#050505',
          surface: '#111111',
          'surface-2': '#1a1a1a',
          border: '#2a2a2a',
          text: '#f5f5f5',
          muted: '#b6b6b6',
        }
      }
    },
  },
  plugins: [],
}
