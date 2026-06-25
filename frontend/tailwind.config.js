/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: '#0A0A0F',
        surface: '#111118',
        'surface-raised': '#16161F',
        border: '#1E1E2E',
        ink: '#E8E8F0',
        muted: '#6B6B80',
        signal: '#00E5A0',
        'signal-dim': 'rgba(0, 229, 160, 0.08)',
        error: '#FF4D6D',
        warn: '#FFB347',
      },
      fontFamily: {
        mono: ['"DM Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '96': '24rem',
      },
      borderRadius: {
        'card': '8px',
        'btn': '6px',
        'input': '6px',
        'badge': '4px',
      },
    },
  },
  plugins: [],
}
