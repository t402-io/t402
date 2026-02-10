/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './theme.config.tsx'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#50AF95',
          secondary: '#26A17B',
          accent: '#1BA27A',
          muted: 'rgba(80, 175, 149, 0.1)',
        }
      }
    }
  },
  plugins: [],
  darkMode: 'class'
}
