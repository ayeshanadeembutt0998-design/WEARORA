/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: '#171717',
        gold: { DEFAULT: '#C69A52', dark: '#A87D3A', soft: '#F3E8D3' },
        ivory: '#FAF8F3',
        beige: '#EAE5DC',
        warmgray: '#77716A',
        // theme-aware tokens (see index.css)
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        surface2: 'rgb(var(--surface2) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        inverse: 'rgb(var(--inverse) / <alpha-value>)',
        'on-inverse': 'rgb(var(--on-inverse) / <alpha-value>)',
      },
      fontFamily: {
        heading: ['Urbanist', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: { soft: '0 1px 2px rgb(23 23 23 / 0.04), 0 8px 24px rgb(23 23 23 / 0.06)' },
      keyframes: { pop: { '0%': { transform: 'scale(.96)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } }, slideIn: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } } },
      animation: { pop: 'pop .18s ease-out', slideIn: 'slideIn .22s ease-out' },
    },
  },
  plugins: [],
};
