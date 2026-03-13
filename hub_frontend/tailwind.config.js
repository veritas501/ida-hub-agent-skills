/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Cascadia Mono"', '"Segoe UI Mono"', '"Roboto Mono"', '"Ubuntu Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        brand: {
          50: "#eef8ff",
          100: "#d9efff",
          600: "#0a84ff",
          700: "#0066d6",
          900: "#0b2440"
        }
      },
      keyframes: {
        slideUpAndFade: {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        slideUpToast: {
          '0%': { opacity: 0, transform: 'translateY(24px) translateX(-50%) scale(0.95)' },
          '100%': { opacity: 1, transform: 'translateY(0) translateX(-50%) scale(1)' },
        }
      },
      animation: {
        'slide-up': 'slideUpAndFade 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'toast': 'slideUpToast 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }
    }
  },
  plugins: []
};
