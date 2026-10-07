const terracotta = {
  50: '#faf1ec',
  100: '#f3ddd0',
  200: '#e9c3ae',
  300: '#db9f80',
  400: '#cd7a56',
  500: '#c06a45',
  600: '#a5573a',
  700: '#854531',
  800: '#6a3a2c',
  900: '#4e2c22',
};

const warmGrey = {
  50: '#f7f3f1',
  100: '#efe8e4',
  200: '#e0d5cf',
  300: '#cbbcb4',
  400: '#a99b92',
  500: '#8c7e76',
  600: '#6f635c',
  700: '#574d47',
  800: '#3f3833',
  900: '#2b2521',
  950: '#1c1815',
};

export default {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './translations.ts',
  ],
  theme: {
    extend: {
      colors: {
        white: 'rgb(var(--tint) / <alpha-value>)',
        teal: terracotta,
        emerald: terracotta,
        cyan: terracotta,
        sky: terracotta,
        yellow: terracotta,
        amber: terracotta,
        slate: warmGrey,
        gray: warmGrey,
      },
    },
  },
  plugins: [],
};
