import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // Dev mirror of the prod nginx same-origin proxies.
        proxy: {
          '/api/wall': {
            target: 'https://elenaprojects.cc',
            changeOrigin: true,
            secure: true,
            headers: {
              'x-tether-proxy': env.WALL_PROXY_SECRET || 'dev',
            },
          },
          '/api/spaces': {
            target: 'https://elenaprojects.cc',
            changeOrigin: true,
            secure: true,
            headers: { 'x-tether-proxy': env.WALL_PROXY_SECRET || 'dev' },
          },
          '/api/companion': {
            target: 'https://elenaprojects.cc',
            changeOrigin: true,
            secure: true,
            headers: { 'x-tether-proxy': env.WALL_PROXY_SECRET || 'dev' },
          },
          '/api/state': {
            target: 'https://elenaprojects.cc',
            changeOrigin: true,
            secure: true,
            headers: {
              'x-tether-proxy': env.WALL_PROXY_SECRET || 'dev',
            },
          },
        },
      },
      plugins: [react()],
      define: {
        // Firebase config isn't provisioned in production; define the keys as empty so the
        // production build doesn't reference a bare `process` (which would crash the app).
        // firebase.ts falls back to placeholders and the app runs on its demo/local data.
        'process.env.FIREBASE_API_KEY': JSON.stringify(env.FIREBASE_API_KEY || ''),
        'process.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(env.FIREBASE_AUTH_DOMAIN || ''),
        'process.env.FIREBASE_DATABASE_URL': JSON.stringify(env.FIREBASE_DATABASE_URL || ''),
        'process.env.FIREBASE_PROJECT_ID': JSON.stringify(env.FIREBASE_PROJECT_ID || ''),
        'process.env.FIREBASE_STORAGE_BUCKET': JSON.stringify(env.FIREBASE_STORAGE_BUCKET || ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              react: ['react', 'react-dom'],
              d3: ['d3'],
              icons: ['lucide-react'],
            },
          },
        },
      },
    };
});
