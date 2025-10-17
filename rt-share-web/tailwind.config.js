import typography  from '@tailwindcss/typography'
import forms       from '@tailwindcss/forms'
import aspectRatio from '@tailwindcss/aspect-ratio'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                'rt-dark': 'var(--color-rt-dark)',
                'rt-sidebar': 'var(--color-rt-sidebar)',
                'rt-card': 'var(--color-rt-card)',
                'rt-message-in': 'var(--color-rt-message-in)',
                'rt-message-out': 'var(--color-rt-message-out)',
                'rt-green': 'var(--color-rt-green)',
                'rt-green-dark': 'var(--color-rt-green-dark)',
                'rt-text-gray': 'var(--color-rt-text-gray)',
                'rt-text-light': 'var(--color-rt-text-light)',
                'rt-text-dark': 'var(--color-rt-text-dark)',
            },
            fontFamily: {
                'inter': ['Inter', 'sans-serif'],
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
