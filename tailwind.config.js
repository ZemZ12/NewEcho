/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // Single accent color per Design Direction — everything else is neutral.
        accent: {
          DEFAULT: '#6366f1', // indigo-500
          light: '#818cf8',
          dark: '#4f46e5',
        },
        surface: {
          DEFAULT: '#ffffff',
          dim: '#f4f4f5',
          dark: '#18181b',
          darkDim: '#27272a',
        },
      },
    },
  },
  plugins: [],
};
