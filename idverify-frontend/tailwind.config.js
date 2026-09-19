/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0F1A33',
          800: '#1B2A4A',
          700: '#253761'
        },
        canvas: '#F4F6FA',
        accent: {
          blue: '#2E6BE6',
          'blue-hover': '#1E54C4'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      }
    },
  },
  plugins: [],
}
