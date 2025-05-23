import { type Config } from 'tailwindcss'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'media',
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#E2232A',
        'primary-dark': '#B21B22',
        'primary-light': '#F06B71',
        'primary-darker': '#8A151B',

        secondary: '#1E1E21',
        'secondary-dark': '#000000',
        'secondary-light': '#4B4B50',

        tertiary: '#F3F4F6',
        'tertiary-dark': '#D1D5DB',
        'tertiary-light': '#FFFFFF',

        edit: '#F59E0B',
        'edit-dark': '#D97706',

        details: '#3B82F6',
        'details-dark': '#2563EB',

        fetch: '#22C55E',
        'fetch-dark': '#16A34A',

        diff: '#8B5CF6',
        'diff-dark': '#7C3AED',

        danger: '#B91C1C',
        'danger-dark': '#7F1D1D',
      },
    },
  },
  plugins: [],
}
