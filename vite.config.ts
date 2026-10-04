import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // In dev the app calls the Worker through this same-origin path, so it
    // also works from a phone on the LAN (no CORS, no localhost on the phone).
    proxy: {
      '/api': { target: 'http://localhost:8787', rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
});
