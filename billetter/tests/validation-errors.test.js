import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import { fastify } from '../src/app.js';

describe('Validation and Error Handling Tests', () => {
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

  describe('Input Validation Tests', () => {
    test('Event creation with invalid data types', async () => {
      // Test with number instead of string for title
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 123,
          external: false,
        },
      });
      expect(response1.statusCode).toBe(400);

      // Test with string instead of boolean for external
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 'Valid Title',
          external: 'yes',
        },
      });
      expect(response2.statusCode).toBe(400);

      // Test with missing required fields
      const response3 = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 'Valid Title',
          // missing external field
        },
      });
      expect(response3.statusCode).toBe(400);

      // Test with extra fields
      const response4 = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 'Valid Title',
          external: false,
          extraField: 'should be ignored or cause error',
        },
      });
      // Should either ignore extra fields (200/201) or reject (400)
      const acceptableStatusCodes = [201, 400];
      expect(acceptableStatusCodes).toContain(response4.statusCode);
    });

    test('Booking creation with invalid event_id', async () => {
      // Test with non-existent event_id
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          event_id: 99999,
        },
      });
      expect(response1.statusCode).toBe(404);

      // Test with invalid data type for event_id
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          event_id: 'invalid',
        },
      });
      expect(response2.statusCode).toBe(400);

      // Test with missing event_id
      const response3 = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {},
      });
      expect(response3.statusCode).toBe(400);

      // Test with negative event_id
      const response4 = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          event_id: -1,
        },
      });
      expect(response4.statusCode).toBe(400);
    });

    test('Seat selection with invalid parameters', async () => {
      // Create valid event and booking first
      const eventResponse = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 'Validation Test Concert',
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

      // Test with non-existent booking_id
      const response1 = await app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: 99999,
          seat_id: 1,
        },
      });
      expect(response1.statusCode).toBe(404);

      // Test with non-existent seat_id
      const response2 = await app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: bookingId,
          seat_id: 99999,
        },
      });
      expect(response2.statusCode).toBe(404);

      // Test with invalid data types
      const response3 = await app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: 'invalid',
          seat_id: 'invalid',
        },
      });
      expect(response3.statusCode).toBe(400);

      // Test with missing parameters
      const response4 = await app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: bookingId,
          // missing seat_id
        },
      });
      expect(response4.statusCode).toBe(400);
    });

    test('Payment operations with invalid parameters', async () => {
      // Test payment initiation with invalid booking_id
      const response1 = await app.inject({
        method: 'PATCH',
        url: '/api/bookings/initiatePayment',
        payload: {
          booking_id: 99999,
        },
      });
      expect(response1.statusCode).toBe(404);

      // Test payment callbacks with missing orderId
      const response2 = await app.inject({
        method: 'GET',
        url: '/api/payments/success',
      });
      expect(response2.statusCode).toBe(400);

      const response3 = await app.inject({
        method: 'GET',
        url: '/api/payments/fail',
      });
      expect(response3.statusCode).toBe(400);

      // Test payment callbacks with invalid orderId
      const response4 = await app.inject({
        method: 'GET',
        url: '/api/payments/success?orderId=invalid',
      });
      expect(response4.statusCode).toBe(400);

      const response5 = await app.inject({
        method: 'GET',
        url: '/api/payments/fail?orderId=invalid',
      });
      expect(response5.statusCode).toBe(400);
    });

    test('Seat listing with invalid query parameters', async () => {
      // Test without required event_id
      const response1 = await app.inject({
        method: 'GET',
        url: '/api/seats',
      });
      expect(response1.statusCode).toBe(400);

      // Test with invalid event_id
      const response2 = await app.inject({
        method: 'GET',
        url: '/api/seats?event_id=invalid',
      });
      expect(response2.statusCode).toBe(400);

      // Test with non-existent event_id
      const response3 = await app.inject({
        method: 'GET',
        url: '/api/seats?event_id=99999',
      });
      expect(response3.statusCode).toBe(404);
    });
  });

  describe('HTTP Method Validation', () => {
    test('Invalid HTTP methods for endpoints', async () => {
      // Create valid event for testing
      const eventResponse = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 'Method Test Concert',
          external: false,
        },
      });
      const eventId = JSON.parse(eventResponse.payload).id;

      // Test invalid methods
      const invalidMethods = [
        { method: 'PUT', url: '/api/events' },
        { method: 'DELETE', url: '/api/events' },
        { method: 'PATCH', url: '/api/events' },
        { method: 'POST', url: '/api/events/1' },
        { method: 'PUT', url: '/api/bookings' },
        { method: 'DELETE', url: '/api/bookings' },
        { method: 'POST', url: `/api/seats?event_id=${eventId}` },
        { method: 'PUT', url: `/api/seats?event_id=${eventId}` },
        { method: 'DELETE', url: `/api/seats?event_id=${eventId}` },
        { method: 'POST', url: '/api/payments/success' },
        { method: 'PUT', url: '/api/payments/success' },
        { method: 'PATCH', url: '/api/payments/success' },
        { method: 'DELETE', url: '/api/payments/success' },
      ];

      for (const test of invalidMethods) {
        const response = await app.inject({
          method: test.method,
          url: test.url,
          payload: test.method !== 'GET' ? {} : undefined,
        });
        // Should return 405 Method Not Allowed or 404 Not Found
        const acceptableStatusCodes = [404, 405];
        expect(acceptableStatusCodes).toContain(response.statusCode);
      }
    });
  });

  describe('Content-Type Validation', () => {
    test('Invalid content types for POST/PATCH requests', async () => {
      // Test event creation with invalid content type
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: 'title=Test&external=false',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
      });
      // Should expect JSON, so should fail
      expect(response1.statusCode).toBe(400);

      // Test with XML content type
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: '<event><title>Test</title><external>false</external></event>',
        headers: {
          'content-type': 'application/xml',
        },
      });
      expect(response2.statusCode).toBe(400);
    });

    test('Missing content type for POST/PATCH requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: JSON.stringify({
          title: 'Test Concert',
          external: false,
        }),
        // No content-type header
      });
      // Fastify might auto-detect JSON or require explicit content-type
      const acceptableStatusCodes = [201, 400];
      expect(acceptableStatusCodes).toContain(response.statusCode);
    });
  });

  describe('Request Body Size Limits', () => {
    test('Extremely large request bodies', async () => {
      // Create very large payload
      const largeTitle = 'A'.repeat(10000); // 10KB title

      const response = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: largeTitle,
          external: false,
        },
      });

      // Should either accept (if within limits) or reject (413 or 400)
      const acceptableStatusCodes = [201, 400, 413];
      expect(acceptableStatusCodes).toContain(response.statusCode);
    });

    test('Malformed JSON requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: '{"title": "Test Concert", "external": false', // Missing closing brace
        headers: {
          'content-type': 'application/json',
        },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Business Logic Validation', () => {
    test('Seat selection on wrong booking states', async () => {
      // Create event and booking
      const eventResponse = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 'State Validation Concert',
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

      // Cancel the booking
      await app.inject({
        method: 'PATCH',
        url: '/api/bookings/cancel',
        payload: {
          booking_id: bookingId,
        },
      });

      // Try to select seat on cancelled booking
      const seatsResponse = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}&page=1&pageSize=1`,
      });
      const seats = JSON.parse(seatsResponse.payload);

      if (seats.length > 0) {
        const selectResponse = await app.inject({
          method: 'PATCH',
          url: '/api/seats/select',
          payload: {
            booking_id: bookingId,
            seat_id: seats[0].id,
          },
        });

        // Should fail because booking is cancelled
        const acceptableStatusCodes = [400, 409, 419];
        expect(acceptableStatusCodes).toContain(selectResponse.statusCode);
      }
    });

    test('Payment initiation without seats', async () => {
      // Create event and booking
      const eventResponse = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 'No Seats Payment Concert',
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

      // Try to initiate payment without selecting any seats
      const paymentResponse = await app.inject({
        method: 'PATCH',
        url: '/api/bookings/initiatePayment',
        payload: {
          booking_id: bookingId,
        },
      });

      // Should either allow (business rule dependent) or reject
      // Implementation might require seats before payment
      const acceptableStatusCodes = [200, 400, 409];
      expect(acceptableStatusCodes).toContain(paymentResponse.statusCode);
    });

    test('Releasing non-selected seats', async () => {
      // Create event
      const eventResponse = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 'Release Test Concert',
          external: false,
        },
      });
      const eventId = JSON.parse(eventResponse.payload).id;

      // Get a seat
      const seatsResponse = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}&page=1&pageSize=1`,
      });
      const seats = JSON.parse(seatsResponse.payload);

      if (seats.length > 0) {
        const seat = seats[0];

        // Try to release seat that was never selected
        const releaseResponse = await app.inject({
          method: 'PATCH',
          url: '/api/seats/release',
          payload: {
            seat_id: seat.id,
          },
        });

        // Should fail or be idempotent
        const acceptableStatusCodes = [200, 400, 409, 419];
        expect(acceptableStatusCodes).toContain(releaseResponse.statusCode);
      }
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('Concurrent operations on same resources', async () => {
      // Already covered in concurrent-booking.test.js
      // This is just a placeholder for additional edge cases
      expect(true).toBe(true);
    });

    test('Very long event titles', async () => {
      const longTitle = 'Concert'.repeat(100); // 700 character title

      const response = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: longTitle,
          external: false,
        },
      });

      // Should either accept or reject based on business rules
      const acceptableStatusCodes = [201, 400];
      expect(acceptableStatusCodes).toContain(response.statusCode);
    });

    test('Unicode and special characters in event titles', async () => {
      const specialTitle = '🎵 Спецконцерт 音楽会 "Special" Concert! 🎸';

      const response = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: specialTitle,
          external: false,
        },
      });

      expect(response.statusCode).toBe(201);

      // Verify the title is preserved correctly
      const eventsResponse = await app.inject({
        method: 'GET',
        url: '/api/events',
      });
      const events = JSON.parse(eventsResponse.payload);
      const createdEvent = events.find((e) => e.title === specialTitle);
      expect(createdEvent).toBeDefined();
    });
  });

  describe('Rate Limiting and Resource Protection', () => {
    test('Rapid successive requests', async () => {
      // Create many events rapidly
      const promises = Array(20)
        .fill()
        .map((_, i) =>
          app.inject({
            method: 'POST',
            url: '/api/events',
            payload: {
              title: `Rapid Event ${i}`,
              external: false,
            },
          })
        );

      const responses = await Promise.all(promises);

      // All should succeed (no rate limiting implemented yet)
      responses.forEach((response) => {
        expect(response.statusCode).toBe(201);
      });
    });
  });
});
