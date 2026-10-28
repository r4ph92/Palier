import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/database/**/*.test.ts'],
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env['TEST_DATABASE_URL'] ?? 'postgres://palier:palier@localhost:5433/palier_test',
    },
  },
});
