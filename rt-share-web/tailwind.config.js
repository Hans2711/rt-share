import typography  from '@tailwindcss/typography'
import forms       from '@tailwindcss/forms'
import aspectRatio from '@tailwindcss/aspect-ratio'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            /* ───────── core palette ───────── */
            colors: {
                /* brand */
                primary: {
                    DEFAULT: '#E2232A',
                    dark:    '#B21B22',
                    light:   '#F06B71', /* light red */
                    darker:  '#8A151B', /* deepest red */
                },

                /* neutrals */
                secondary: {
                    DEFAULT: '#1E1E21',
                    dark:    '#000000',
                    light:   '#4B4B50',
                },
                tertiary: {
                    DEFAULT: '#F3F4F6',
                    dark:    '#D1D5DB',
                    light:   '#FFFFFF',
                },

                /* semantic button hues */
                edit: {
                    DEFAULT: '#F59E0B',  /* amber-500  */
                    dark:    '#D97706',  /* amber-600  */
                },

                details: {
                    DEFAULT: '#3B82F6', /* blue-500   */
                    dark:    '#2563EB', /* blue-600   */
                },

                fetch: {
                    DEFAULT: '#22C55E',  /* green-500  */
                    dark:    '#16A34A',  /* green-600  */
                },

                diff: {
                    DEFAULT: '#8B5CF6',   /* violet-500 */
                    dark:    '#7C3AED',   /* violet-600 */
                },

                danger: {
                    DEFAULT: '#B91C1C',   // red-700
                    dark:    '#7F1D1D',   // red-800
                },
            },

            /* container settings … */
            container: {
                center: true,
                padding: '1rem',
                screens: {
                    sm: '520px',
                    md: '648px',
                    lg: '904px',
                    xl: '1160px',
                    '2xl': '1416px',
                },
            },
        },
    },
    plugins: [ typography, forms, aspectRatio ],
}
