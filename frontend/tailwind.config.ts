import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        p0:      'var(--p0)',
        p1:      'var(--p1)',
        p2:      'var(--p2)',
        p3:      'var(--p3)',
        pd1:     'var(--pd1)',
        pd2:     'var(--pd2)',
        bg:      'var(--bg)',
        surface: 'var(--surface)',
        ftext:   'var(--text)',
        muted:   'var(--muted)',
      },
    },
  },
  plugins: [],
}

export default config
