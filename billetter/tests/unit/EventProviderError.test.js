import { describe, test, expect } from 'vitest';
import EventProviderError from '../../src/services/EventProviderError.js';

describe('EventProviderError', () => {
  test('should create error with message, status code, and response body', () => {
    const message = 'API request failed';
    const statusCode = 404;
    const responseBody = { error: 'Not found' };

    const error = new EventProviderError(message, statusCode, responseBody);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(EventProviderError);
    expect(error.message).toBe(message);
    expect(error.name).toBe('EventProviderError');
    expect(error.statusCode).toBe(statusCode);
    expect(error.responseBody).toEqual(responseBody);
  });

  test('should create error with minimal parameters', () => {
    const message = 'Simple error';
    const statusCode = 500;

    const error = new EventProviderError(message, statusCode);

    expect(error.message).toBe(message);
    expect(error.statusCode).toBe(statusCode);
    expect(error.responseBody).toBeUndefined();
  });

  test('should have correct error name and inheritance', () => {
    const error = new EventProviderError('Test error', 400, {});

    expect(error.name).toBe('EventProviderError');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof EventProviderError).toBe(true);
  });

  test('should preserve stack trace', () => {
    const error = new EventProviderError('Test error', 400, {});

    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
    expect(error.stack).toContain('EventProviderError');
  });
});
