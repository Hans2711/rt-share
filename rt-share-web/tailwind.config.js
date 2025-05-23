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
                primary:       '#E2232A',
                'primary-dark':'#B21B22',
                'primary-light':  '#F06B71', /* light red */
                'primary-darker': '#8A151B', /* deepest red */

                /* neutrals */
                secondary:       '#1E1E21',
                'secondary-dark':'#000000',
                'secondary-light':'#4B4B50',
                tertiary:        '#F3F4F6',
                'tertiary-dark': '#D1D5DB',
                'tertiary-light':'#FFFFFF',

                /* semantic button hues */
                edit:       '#F59E0B',  /* amber-500  */
                'edit-dark':'#D97706',  /* amber-600  */

                details:       '#3B82F6', /* blue-500   */
                'details-dark':'#2563EB', /* blue-600   */

                fetch:       '#22C55E',  /* green-500  */
                'fetch-dark':'#16A34A',  /* green-600  */

                diff:       '#8B5CF6',   /* violet-500 */
                'diff-dark':'#7C3AED',   /* violet-600 */

                danger:        '#B91C1C',   // red-700
                'danger-dark': '#7F1D1D',   // red-800
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
