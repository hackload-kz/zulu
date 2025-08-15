import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Include only stress tests
    include: ['**/tests/stress/**/*.test.js'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Extended timeouts for stress tests
    testTimeout: 600000, // 10 minutes default
    hookTimeout: 30000, // 30 seconds for setup/teardown
    // Stress tests typically run serially to avoid resource contention
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run tests in single process for better resource management
      },
    },
    // Disable coverage for stress tests as they focus on performance, not coverage
    coverage: {
      enabled: false,
    },
    // Increased memory limits for stress tests
    maxConcurrency: 1, // Run stress tests one at a time
    // Verbose reporting for stress tests
    reporter: ['verbose'],
    // Bail on first failure to save resources
    bail: 1,
  },
});
