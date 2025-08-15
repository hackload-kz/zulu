import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/tests/**/*.js', '**/?(*.)+(spec|test).js'],
    coverage: {
      include: ['src/**/*.js'],
      exclude: ['src/**/*.test.js', 'src/**/*.spec.js'],
      reporter: ['text', 'lcov', 'html'],
    },
  },
});
