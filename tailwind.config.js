import formsPlugin from '@tailwindcss/forms';
import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./src/index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                gray: colors.slate,
                blue: colors.indigo,
            }
        },
    },
    plugins: [
        formsPlugin,
    ],
};
