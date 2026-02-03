/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#09090B',
        foreground: '#E4E4E7',
        card: '#18181B',
        'card-foreground': '#E4E4E7',
        popover: '#18181B',
        'popover-foreground': '#E4E4E7',
        primary: '#22C55E',
        'primary-foreground': '#000000',
        secondary: '#27272A',
        'secondary-foreground': '#E4E4E7',
        muted: '#27272A',
        'muted-foreground': '#A1A1AA',
        accent: '#22C55E',
        'accent-foreground': '#000000',
        destructive: '#EF4444',
        'destructive-foreground': '#FFFFFF',
        border: '#27272A',
        input: '#27272A',
        ring: '#22C55E',
        online: '#22C55E',
        offline: '#EF4444',
        warning: '#EAB308',
        maintenance: '#3B82F6'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
}
