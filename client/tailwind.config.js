/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#ecfdf3', 100: '#d1fae0', 200: '#a7f3c6', 300: '#6ee7a5', 400: '#34d383', 500: '#12b866', 600: '#0a9552', 700: '#087744', 800: '#0a5f39', 900: '#0b4d31', 950: '#032b1a' },
        ink: { 50: '#f5f6f5', 100: '#e7e9e7', 200: '#cfd3cf', 300: '#a9b0a9', 400: '#7c857d', 500: '#5b645c', 600: '#444c45', 700: '#343a35', 800: '#262b27', 900: '#1b1f1c' },
        paper: '#f6f7f3',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
