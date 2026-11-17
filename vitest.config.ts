import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@always/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@always/db': fileURLToPath(new URL('./packages/db/src/index.ts', import.meta.url)),
      '@always/sdk': fileURLToPath(new URL('./packages/sdk/src/index.ts', import.meta.url)),
    },
  },
  test: { globals: true, fileParallelism: false, testTimeout: 20000 },
});
