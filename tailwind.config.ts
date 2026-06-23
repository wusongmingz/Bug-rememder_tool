import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './index.html',
  ],
  theme: {
    extend: {
      colors: {
        deep: '#0f0f23',
        glass: 'rgba(30, 30, 60, 0.6)',
        accent: '#00ff88',
        warning: '#ff6b35',
        info: '#4ecdc4',
        textPrimary: '#e0e0e0',
        textSecondary: '#8888aa',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
      animation: {
        blink: 'blink 1s infinite',
      },
    },
  },
  plugins: [],
}

export default config
