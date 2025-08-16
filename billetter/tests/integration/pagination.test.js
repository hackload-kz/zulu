import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import { fastify } from '../../src/app.js';

describe('Test Scenario 5: Pagination in Large Seat Lists', () => {
  let app;

  beforeAll(async () => {
    app = fastify;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Reset the service state before each test
    if (app.billetterService && app.billetterService.reset) {
      app.billetterService.reset();
    }
  });

  test('Validate correct page size boundaries', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Large Venue Concert',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    // Test minimum valid page size (1)
    const minResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=1`,
    });
    expect(minResponse.statusCode).toBe(200);
    const minSeats = JSON.parse(minResponse.payload);
    expect(minSeats.length).toBeLessThanOrEqual(1);

    // Test maximum valid page size (20)
    const maxResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=20`,
    });
    expect(maxResponse.statusCode).toBe(200);
    const maxSeats = JSON.parse(maxResponse.payload);
    expect(maxSeats.length).toBeLessThanOrEqual(20);

    // Test invalid page size (0)
    const zeroResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=0`,
    });
    expect(zeroResponse.statusCode).toBe(400);

    // Test invalid page size (too large)
    const tooLargeResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=25`,
    });
    expect(tooLargeResponse.statusCode).toBe(400);

    // Test invalid page size (negative)
    const negativeResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=-1`,
    });
    expect(negativeResponse.statusCode).toBe(400);
  });

  test('Validate page number boundaries', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Page Boundary Concert',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    // Test minimum valid page (1)
    const validResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=10`,
    });
    expect(validResponse.statusCode).toBe(200);

    // Test invalid page (0)
    const zeroPageResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=0&pageSize=10`,
    });
    expect(zeroPageResponse.statusCode).toBe(400);

    // Test invalid page (negative)
    const negativePageResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=-1&pageSize=10`,
    });
    expect(negativePageResponse.statusCode).toBe(400);

    // Test very high page number (should return empty or 404)
    const highPageResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=10000&pageSize=10`,
    });
    // Should either return empty array or 404, both are acceptable
    const acceptableStatusCodes = [200, 404];
    expect(acceptableStatusCodes).toContain(highPageResponse.statusCode);

    if (highPageResponse.statusCode === 200) {
      const seats = JSON.parse(highPageResponse.payload);
      expect(Array.isArray(seats)).toBe(true);
      expect(seats.length).toBe(0);
    }
  });

  test('Content order consistency across pages', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Order Consistency Concert',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    // Get multiple pages
    const page1Response = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=5`,
    });
    expect(page1Response.statusCode).toBe(200);
    const page1Seats = JSON.parse(page1Response.payload);

    const page2Response = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=2&pageSize=5`,
    });
    expect(page2Response.statusCode).toBe(200);
    const page2Seats = JSON.parse(page2Response.payload);

    // Verify no duplicates between pages
    const page1Ids = page1Seats.map((seat) => seat.id);
    const page2Ids = page2Seats.map((seat) => seat.id);
    const duplicates = page1Ids.filter((id) => page2Ids.includes(id));
    expect(duplicates.length).toBe(0);

    // Verify consistent ordering (seats should have consistent structure)
    if (page1Seats.length > 0) {
      expect(page1Seats[0]).toHaveProperty('id');
      expect(page1Seats[0]).toHaveProperty('row');
      expect(page1Seats[0]).toHaveProperty('number');
      expect(page1Seats[0]).toHaveProperty('status');
      expect(page1Seats[0]).toHaveProperty('price');
    }

    if (page2Seats.length > 0) {
      expect(page2Seats[0]).toHaveProperty('id');
      expect(page2Seats[0]).toHaveProperty('row');
      expect(page2Seats[0]).toHaveProperty('number');
      expect(page2Seats[0]).toHaveProperty('status');
      expect(page2Seats[0]).toHaveProperty('price');
    }

    // Test retrieving same page twice for consistency
    const page1DuplicateResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=5`,
    });
    const page1DuplicateSeats = JSON.parse(page1DuplicateResponse.payload);

    // Should return identical results
    expect(page1DuplicateSeats).toEqual(page1Seats);
  });

  test('Pagination with large dataset simulation', async () => {
    // Create event for large dataset
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Stadium Concert - 100k Seats',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    // Test multiple page sizes to ensure they work correctly
    const pageSizes = [1, 5, 10, 15, 20];

    for (const pageSize of pageSizes) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}&page=1&pageSize=${pageSize}`,
      });

      expect(response.statusCode).toBe(200);
      const seats = JSON.parse(response.payload);
      expect(Array.isArray(seats)).toBe(true);
      expect(seats.length).toBeLessThanOrEqual(pageSize);

      // Each seat should have proper structure
      seats.forEach((seat) => {
        expect(seat).toHaveProperty('id');
        expect(seat).toHaveProperty('row');
        expect(seat).toHaveProperty('number');
        expect(seat).toHaveProperty('status');
        expect(seat).toHaveProperty('price');
        expect(typeof seat.id).toBe('number');
        expect(typeof seat.row).toBe('number');
        expect(typeof seat.number).toBe('number');
        expect(typeof seat.status).toBe('string');
        expect(['FREE', 'RESERVED', 'SOLD']).toContain(seat.status);
        expect(typeof seat.price).toBe('string');
      });
    }
  });

  test('Pagination performance with different page sizes', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Performance Test Concert',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    // Test response times for different page sizes
    const pageSizes = [1, 10, 20];
    const performanceResults = [];

    for (const pageSize of pageSizes) {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}&page=1&pageSize=${pageSize}`,
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.statusCode).toBe(200);
      performanceResults.push({ pageSize, responseTime });
    }

    // All requests should complete in reasonable time (under 1 second)
    performanceResults.forEach((result) => {
      expect(result.responseTime).toBeLessThan(1000);
    });

    console.log('Pagination performance results:', performanceResults);
  });

  test('Navigate through multiple pages sequentially', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Sequential Navigation Concert',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    const pageSize = 3;
    const maxPages = 5;
    const allSeats = [];
    let currentPage = 1;

    // Navigate through pages until empty or max pages reached
    while (currentPage <= maxPages) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}&page=${currentPage}&pageSize=${pageSize}`,
      });

      expect(response.statusCode).toBe(200);
      const seats = JSON.parse(response.payload);

      if (seats.length === 0) {
        break; // No more seats
      }

      // Verify no duplicates with previous pages
      const newSeatIds = seats.map((s) => s.id);
      const existingIds = allSeats.map((s) => s.id);
      const duplicates = newSeatIds.filter((id) => existingIds.includes(id));
      expect(duplicates.length).toBe(0);

      allSeats.push(...seats);
      currentPage++;
    }

    // Should have retrieved some seats
    expect(allSeats.length).toBeGreaterThan(0);

    // All seats should have unique IDs
    const seatIds = allSeats.map((s) => s.id);
    const uniqueIds = [...new Set(seatIds)];
    expect(uniqueIds.length).toBe(seatIds.length);
  });

  test('Pagination with seat reservations', async () => {
    // Create event and booking
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Reservation Pagination Concert',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    const bookingResponse = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      payload: {
        event_id: eventId,
      },
    });
    const bookingId = JSON.parse(bookingResponse.payload).id;

    // Get first page and reserve some seats
    const page1Response = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=5`,
    });
    const page1Seats = JSON.parse(page1Response.payload);
    const seatsToReserve = page1Seats
      .filter((s) => !s.status === 'RESERVED')
      .slice(0, 2);

    for (const seat of seatsToReserve) {
      await app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: bookingId,
          seat_id: seat.id,
        },
      });
    }

    // Get updated first page
    const updatedPage1Response = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=5`,
    });
    const updatedPage1Seats = JSON.parse(updatedPage1Response.payload);

    // Reserved seats should be marked as reserved
    for (const reservedSeat of seatsToReserve) {
      const updatedSeat = updatedPage1Seats.find(
        (s) => s.id === reservedSeat.id
      );
      expect(updatedSeat.status).toBe('RESERVED');
    }

    // Get second page to ensure reservations don't affect other pages
    const page2Response = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=2&pageSize=5`,
    });
    expect(page2Response.statusCode).toBe(200);
    const page2Seats = JSON.parse(page2Response.payload);

    // Page 2 seats should not be affected by page 1 reservations
    // (unless they happen to be the same seats, which they shouldn't be)
    const page1ReservedIds = seatsToReserve.map((s) => s.id);
    const page2Ids = page2Seats.map((s) => s.id);
    const overlap = page1ReservedIds.filter((id) => page2Ids.includes(id));
    expect(overlap.length).toBe(0); // No overlap expected
  });

  test('Default pagination behavior', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Default Pagination Concert',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    // Test with only event_id (no pagination params)
    const noPaginationResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}`,
    });
    expect(noPaginationResponse.statusCode).toBe(200);
    const noPaginationSeats = JSON.parse(noPaginationResponse.payload);

    // Test with explicit page but no pageSize
    const noPageSizeResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1`,
    });
    expect(noPageSizeResponse.statusCode).toBe(200);
    const noPageSizeSeats = JSON.parse(noPageSizeResponse.payload);

    // Test with pageSize but no page
    const noPageResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&pageSize=10`,
    });
    expect(noPageResponse.statusCode).toBe(200);
    const noPageSeats = JSON.parse(noPageResponse.payload);

    // All responses should return valid arrays
    expect(Array.isArray(noPaginationSeats)).toBe(true);
    expect(Array.isArray(noPageSizeSeats)).toBe(true);
    expect(Array.isArray(noPageSeats)).toBe(true);
  });

  test('Invalid pagination parameters', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Invalid Params Concert',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    // Test non-numeric page
    const nonNumericPageResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=abc&pageSize=10`,
    });
    expect(nonNumericPageResponse.statusCode).toBe(400);

    // Test non-numeric pageSize
    const nonNumericPageSizeResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=xyz`,
    });
    expect(nonNumericPageSizeResponse.statusCode).toBe(400);

    // Test decimal page
    const decimalPageResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1.5&pageSize=10`,
    });
    expect(decimalPageResponse.statusCode).toBe(400);

    // Test decimal pageSize
    const decimalPageSizeResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=10.5`,
    });
    expect(decimalPageSizeResponse.statusCode).toBe(400);
  });
});
