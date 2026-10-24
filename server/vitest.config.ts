import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      // Test uploads go to a temp folder, never into server/uploads.
      UPLOAD_DIR: path.join(os.tmpdir(), 'campuscare-test-uploads'),
    },
    testTimeout: 20_000,
    hookTimeout: 120_000, // first run downloads a MongoDB binary
  },
});
