/// <reference types="vitest/config" />
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Read ONLY API_PORT from the shared root .env, for the dev proxy.
// (Vite's loadEnv() is deliberately not used: it would also pick up NODE_ENV=development
// from that file and silently make production builds use React's development mode.)
// Nothing from .env is exposed to browser code.
function readApiPort(): string {
  try {
    const file = fs.readFileSync(path.resolve(import.meta.dirname, '../.env'), 'utf8');
    return parseEnv(file).API_PORT || '4000';
  } catch {
    return '4000'; // no .env file yet
  }
}
const apiPort = readApiPort();

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
