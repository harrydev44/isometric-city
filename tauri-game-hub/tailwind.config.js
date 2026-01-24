/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: '#1e1e2e',
          hover: '#2a2a3e',
          active: '#3a3a4e',
          border: '#3a3a4e',
        },
        pane: {
          bg: '#0d0d14',
          border: '#2a2a3e',
        }
      }
    },
  },
  plugins: [],
}

