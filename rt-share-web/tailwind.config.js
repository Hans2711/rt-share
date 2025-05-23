import typography  from '@tailwindcss/typography'
import forms       from '@tailwindcss/forms'
import aspectRatio from '@tailwindcss/aspect-ratio'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
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
