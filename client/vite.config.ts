/// <reference types="vitest/config" />
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Read API_PORT from the shared root .env (server-only values are NOT exposed to the browser).
const rootEnv = loadEnv('development', path.resolve(import.meta.dirname, '..'), '');
const apiPort = rootEnv.API_PORT || '4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // Forward /api calls to the Express server so the browser sees one origin
    // (this keeps login cookies simple and avoids CORS problems in development).
    proxy: { '/api': `http://localhost:${apiPort}` },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
