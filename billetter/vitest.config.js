import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Include only unit and integration tests, exclude stress tests
    include: [
      '**/tests/unit/**/*.js',
      '**/tests/integration/**/*.js',
      '**/?(*.)+(spec|test).js',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/stress/**', // Exclude stress tests from regular runs
    ],
    // Set reasonable timeouts for regular tests
    testTimeout: 30000, // 30 seconds
    hookTimeout: 10000, // 10 seconds
    coverage: {
      include: ['src/**/*.js'],
      exclude: ['src/**/*.test.js', 'src/**/*.spec.js'],
      reporter: ['text', 'lcov', 'html'],
    },
  },
});
