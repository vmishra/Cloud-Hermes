import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The dev server proxies the API and WebSocket to the orchestration server so
 * the web app can use same-origin relative URLs in every environment.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4316,
    proxy: {
      '/health': 'http://127.0.0.1:4317',
      '/ws': { target: 'ws://127.0.0.1:4317', ws: true },
    },
  },
});
