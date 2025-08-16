import { describe, test, expect, beforeEach, vi } from 'vitest';
import EventProviderService from '../../src/services/EventProviderService.js';
import EventProviderError from '../../src/services/EventProviderError.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('EventProviderService', () => {
  let service;
  const baseURL = 'http://localhost:8080/api';

  beforeEach(() => {
    service = new EventProviderService({ baseURL });
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with provided baseURL', () => {
      const testURL = 'https://api.example.com';
      const testService = new EventProviderService({ baseURL: testURL });
      expect(testService.baseURL).toBe(testURL);
    });
  });

  describe('_makeRequest', () => {
    test('should make successful GET request', async () => {
      const mockResponse = { id: '123', status: 'STARTED' };
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
        headers: new Map([['content-length', '100']]),
      });

      const result = await service._makeRequest('/test', 'GET');

      expect(fetch).toHaveBeenCalledWith(`${baseURL}/test`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(mockResponse);
    });

    test('should make successful POST request with body', async () => {
      const requestBody = { order_id: '123' };
      const mockResponse = { success: true };
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
        headers: new Map([['content-length', '100']]),
      });

      const result = await service._makeRequest('/test', 'POST', requestBody);

      expect(fetch).toHaveBeenCalledWith(`${baseURL}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      expect(result).toEqual(mockResponse);
    });

    test('should handle 204 No Content response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Map([['content-length', '0']]),
      });

      const result = await service._makeRequest('/test', 'PATCH');
      expect(result).toBeUndefined();
    });

    test('should throw EventProviderError for API errors with JSON response', async () => {
      const errorResponse = { error: 'Order not found' };
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve(errorResponse),
      });

      try {
        await service._makeRequest('/test', 'GET');
        expect.fail('Expected method to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(EventProviderError);
        expect(error.message).toBe('API request failed: 404 Not Found');
        expect(error.statusCode).toBe(404);
        expect(error.responseBody).toEqual(errorResponse);
      }
    });

    test('should throw EventProviderError for API errors with text response', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Not JSON')),
        text: () => Promise.resolve('Server Error'),
      });

      await expect(service._makeRequest('/test', 'GET')).rejects.toThrow(
        EventProviderError
      );
    });

    test('should re-throw network errors as-is', async () => {
      const networkError = new Error('Network error');
      fetch.mockRejectedValueOnce(networkError);

      await expect(service._makeRequest('/test', 'GET')).rejects.toThrow(
        'Network error'
      );
      await expect(service._makeRequest('/test', 'GET')).rejects.not.toThrow(
        EventProviderError
      );
    });
  });

  describe('startOrder', () => {
    test('should create a new order successfully', async () => {
      const mockResponse = { order_id: 'order-123' };
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(mockResponse),
        headers: new Map([['content-length', '100']]),
      });

      const result = await service.startOrder();

      expect(fetch).toHaveBeenCalledWith(`${baseURL}/partners/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(mockResponse);
    });

    test('should handle API errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid request' }),
      });

      await expect(service.startOrder()).rejects.toThrow(EventProviderError);
    });
  });

  describe('getOrder', () => {
    test('should retrieve order details successfully', async () => {
      const orderId = 'order-123';
      const mockOrder = {
        id: orderId,
        status: 'STARTED',
        started_at: 1640995200000,
        updated_at: 1640995200000,
        places_count: 0,
      };
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockOrder),
        headers: new Map([['content-length', '100']]),
      });

      const result = await service.getOrder(orderId);

      expect(fetch).toHaveBeenCalledWith(
        `${baseURL}/partners/v1/orders/${orderId}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      expect(result).toEqual(mockOrder);
    });

    test('should handle order not found', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Order not found' }),
      });

      await expect(service.getOrder('nonexistent')).rejects.toThrow(
        EventProviderError
      );
    });
  });

  describe('submitOrder', () => {
    test('should submit order successfully', async () => {
      const orderId = 'order-123';
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Map([['content-length', '0']]),
      });

      await service.submitOrder(orderId);

      expect(fetch).toHaveBeenCalledWith(
        `${baseURL}/partners/v1/orders/${orderId}/submit`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    test('should handle invalid state transition', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () => Promise.resolve({ error: 'Invalid state transition' }),
      });

      await expect(service.submitOrder('order-123')).rejects.toThrow(
        EventProviderError
      );
    });
  });

  describe('confirmOrder', () => {
    test('should confirm order successfully', async () => {
      const orderId = 'order-123';
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Map([['content-length', '0']]),
      });

      await service.confirmOrder(orderId);

      expect(fetch).toHaveBeenCalledWith(
        `${baseURL}/partners/v1/orders/${orderId}/confirm`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
  });

  describe('cancelOrder', () => {
    test('should cancel order successfully', async () => {
      const orderId = 'order-123';
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Map([['content-length', '0']]),
      });

      await service.cancelOrder(orderId);

      expect(fetch).toHaveBeenCalledWith(
        `${baseURL}/partners/v1/orders/${orderId}/cancel`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
  });

  describe('listPlaces', () => {
    test('should list places without pagination params', async () => {
      const mockPlaces = [
        { id: 'place-1', row: 1, seat: 1, is_free: true },
        { id: 'place-2', row: 1, seat: 2, is_free: false },
      ];
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockPlaces),
        headers: new Map([['content-length', '100']]),
      });

      const result = await service.listPlaces();

      expect(fetch).toHaveBeenCalledWith(`${baseURL}/partners/v1/places`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(mockPlaces);
    });

    test('should list places with pagination params', async () => {
      const mockPlaces = [{ id: 'place-1', row: 1, seat: 1, is_free: true }];
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockPlaces),
        headers: new Map([['content-length', '100']]),
      });

      const result = await service.listPlaces({ page: 2, pageSize: 10 });

      expect(fetch).toHaveBeenCalledWith(
        `${baseURL}/partners/v1/places?page=2&pageSize=10`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      expect(result).toEqual(mockPlaces);
    });

    test('should list places with partial pagination params', async () => {
      const mockPlaces = [];
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockPlaces),
        headers: new Map([['content-length', '100']]),
      });

      await service.listPlaces({ page: 1 });

      expect(fetch).toHaveBeenCalledWith(
        `${baseURL}/partners/v1/places?page=1`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
  });

  describe('getPlace', () => {
    test('should retrieve place details successfully', async () => {
      const placeId = 'place-123';
      const mockPlace = { id: placeId, row: 5, seat: 10, is_free: true };
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockPlace),
        headers: new Map([['content-length', '100']]),
      });

      const result = await service.getPlace(placeId);

      expect(fetch).toHaveBeenCalledWith(
        `${baseURL}/partners/v1/places/${placeId}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      expect(result).toEqual(mockPlace);
    });
  });

  describe('selectPlace', () => {
    test('should select place successfully', async () => {
      const placeId = 'place-123';
      const orderId = 'order-456';
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Map([['content-length', '0']]),
      });

      await service.selectPlace(placeId, orderId);

      expect(fetch).toHaveBeenCalledWith(
        `${baseURL}/partners/v1/places/${placeId}/select`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId }),
        }
      );
    });

    test('should handle place already selected error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () => Promise.resolve({ error: 'Place already selected' }),
      });

      await expect(
        service.selectPlace('place-123', 'order-456')
      ).rejects.toThrow(EventProviderError);
    });
  });

  describe('releasePlace', () => {
    test('should release place successfully', async () => {
      const placeId = 'place-123';
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Map([['content-length', '0']]),
      });

      await service.releasePlace(placeId);

      expect(fetch).toHaveBeenCalledWith(
        `${baseURL}/partners/v1/places/${placeId}/release`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    test('should handle place not selected error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () => Promise.resolve({ error: 'Place not selected' }),
      });

      await expect(service.releasePlace('place-123')).rejects.toThrow(
        EventProviderError
      );
    });
  });
});
