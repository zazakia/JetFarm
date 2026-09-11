const brandBlue = {
  50: '#F0F9FF',
  100: '#E0F2FE',
  200: '#BAE6FD',
  300: '#7DD3FC',
  400: '#38BDF8',
  500: '#1E3A8A', // Sleek Navy Blue
  600: '#1D4ED8', // Premium Blue
  700: '#1E40AF', // Deep Blue
  800: '#1E3A5F', // Header Blue
  900: '#0C4A6E', // Midnight Slate
};

const brandYellow = {
  50: '#FEFCE8',
  100: '#FEF9C3',
  200: '#FEF08A',
  300: '#FDE047',
  400: '#FACC15',
  500: '#EAB308', // Gold/Yellow
  600: '#CA8A04',
  700: '#A16207',
  800: '#854D0E',
  900: '#713F12',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./src/hooks/**/*.{js,jsx,ts,tsx}",
    "./src/services/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hunter: brandBlue,
        emerald: brandBlue,
        blue: brandBlue,
        yellow: brandYellow,
      },
    },
  },
  plugins: [],
}
