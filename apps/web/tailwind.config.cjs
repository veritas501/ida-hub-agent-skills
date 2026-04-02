/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '"Source Han Sans SC"', '"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', '"Fira Code"', '"Roboto Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        brand: {
          50:  "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          400: "#f0944f",
          500: "#e87b35",
          600: "#d46a28",
          700: "#b45520",
          900: "#4a2510",
        }
      },
      borderRadius: {
        'card': '0.75rem',
        'sub':  '0.625rem',
        'btn':  '0.5rem',
        'tag':  '0.375rem',
      },
      keyframes: {
        slideUpAndFade: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUpToast: {
          '0%':   { opacity: '0', transform: 'translateY(16px) translateX(-50%) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) translateX(-50%) scale(1)' },
        },
        pulseDot: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(61, 206, 128, 0.4)' },
          '50%':      { boxShadow: '0 0 0 5px rgba(61, 206, 128, 0)' },
        },
      },
      animation: {
        'slide-up': 'slideUpAndFade 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'toast':    'slideUpToast 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
