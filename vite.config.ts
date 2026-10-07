import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // The PHP endpoints in public/api, served by `npm run api`. Same origin
    // as the app, so the session cookie and Origin checks behave as they do
    // on Hostinger, where the API sits beside the build under /nextthyme/.
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
});
