/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        nexa: {
          bg: '#06030f', // deep indigo-black base (lets the synthwave backdrop glow through)
          panel: 'rgba(255,255,255,0.04)',
          line: 'rgba(255,255,255,0.10)',
          ok: '#34d399',
          warn: '#fbbf24',
          crit: '#fb7185',
          accent: '#22d3ee', // electric cyan
          accent2: '#38bdf8', // sky blue
          accent3: '#a855f7', // violet
          accent4: '#f472b6', // neon pink
        },
      },
      borderRadius: {
        '2.5xl': '1.25rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.05), 0 18px 50px -12px rgba(0,0,0,0.8)',
        'glow-ok': '0 0 40px -8px rgba(52,211,153,0.45)',
        'glow-warn': '0 0 40px -8px rgba(251,191,36,0.5)',
        'glow-crit': '0 0 48px -6px rgba(251,113,133,0.6)',
        'glow-accent': '0 0 40px -8px rgba(34,211,238,0.5)', // cyan rim-light
        'glow-violet': '0 0 40px -8px rgba(168,85,247,0.5)',
        // Layered elevation for the tactile "3D" card surface (top highlight + drop shadow).
        depth:
          'inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 -1px 0 0 rgba(0,0,0,0.45), 0 24px 48px -22px rgba(0,0,0,0.85), 0 8px 20px -12px rgba(0,0,0,0.6)',
        'depth-hover':
          'inset 0 1px 0 0 rgba(255,255,255,0.12), inset 0 -1px 0 0 rgba(0,0,0,0.5), 0 36px 70px -24px rgba(0,0,0,0.9), 0 0 44px -12px rgba(45,212,191,0.35)',
        'inset-tile':
          'inset 0 1px 0 0 rgba(255,255,255,0.04), inset 0 -2px 4px 0 rgba(0,0,0,0.4)',
      },
      keyframes: {
        pulseSoft: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        floatIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.985)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-700px 0' },
          '100%': { backgroundPosition: '700px 0' },
        },
        sheen: {
          '0%': { transform: 'translateX(-120%)' },
          '60%,100%': { transform: 'translateX(220%)' },
        },
        ringPulse: {
          '0%,100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.15', transform: 'scale(1.06)' },
        },
      },
      animation: {
        'pulse-soft': 'pulseSoft 1.6s ease-in-out infinite',
        'float-in': 'floatIn 0.35s ease-out both',
        rise: 'rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 2.4s linear infinite',
        sheen: 'sheen 5s ease-in-out infinite',
        'ring-pulse': 'ringPulse 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
