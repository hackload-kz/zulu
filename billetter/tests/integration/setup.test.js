import { describe, test, expect } from 'vitest';

describe('Test Setup Verification', () => {
  test('Vitest is working correctly', () => {
    expect(2 + 2).toBe(4);
  });

  test('ES modules are supported', async () => {
    const { fastify } = await import('../../src/app.js');
    expect(fastify).toBeDefined();
  });
});
