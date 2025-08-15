import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import { fastify } from '../../src/app.js';

describe('Billetter API Tests', () => {
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

  describe('Health Check', () => {
    test('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.status).toBe('ok');
      expect(payload.timestamp).toBeDefined();
    });
  });

  describe('Events API', () => {
    test('should create a new event', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 'Test Concert',
          external: false,
        },
      });

      expect(response.statusCode).toBe(201);
      const payload = JSON.parse(response.payload);
      expect(payload.id).toBeDefined();
      expect(typeof payload.id).toBe('number');
    });

    test('should get all events', async () => {
      // Create an event first
      await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 'Test Concert',
          external: false,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/events',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
      expect(payload.length).toBeGreaterThan(0);
      expect(payload[0]).toHaveProperty('id');
      expect(payload[0]).toHaveProperty('title');
    });

    test('should validate event creation with missing fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 'Test Concert',
          // missing external field
        },
      });

      expect(response.statusCode).toBe(400);
    });

    test('should validate event creation with invalid data types', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 123, // should be string
          external: 'yes', // should be boolean
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Bookings API', () => {
    let eventId;

    beforeEach(async () => {
      // Create an event for booking tests
      const eventResponse = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 'Test Concert for Booking',
          external: false,
        },
      });
      eventId = JSON.parse(eventResponse.payload).id;
    });

    test('should create a new booking', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          event_id: eventId,
        },
      });

      expect(response.statusCode).toBe(201);
      const payload = JSON.parse(response.payload);
      expect(payload.id).toBeDefined();
      expect(typeof payload.id).toBe('number');
    });

    test('should get all bookings', async () => {
      // Create a booking first
      await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          event_id: eventId,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/bookings',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
    });

    test('should initiate payment for booking', async () => {
      // Create a booking first
      const bookingResponse = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          event_id: eventId,
        },
      });
      const bookingId = JSON.parse(bookingResponse.payload).id;

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/bookings/initiatePayment',
        payload: {
          booking_id: bookingId,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.payload).toBe(
        '"Booking is awaiting payment confirmation"'
      );
    });

    test('should cancel booking', async () => {
      // Create a booking first
      const bookingResponse = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          event_id: eventId,
        },
      });
      const bookingId = JSON.parse(bookingResponse.payload).id;

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/bookings/cancel',
        payload: {
          booking_id: bookingId,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.payload).toBe('"Booking successfully cancelled"');
    });

    test('should validate booking creation with invalid event_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          event_id: 99999, // non-existent event
        },
      });

      expect(response.statusCode).toBe(404);
    });

    test('should validate payment initiation with invalid booking_id', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/bookings/initiatePayment',
        payload: {
          booking_id: 99999, // non-existent booking
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Seats API', () => {
    let eventId;

    beforeEach(async () => {
      // Create an event for seat tests
      const eventResponse = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 'Test Concert for Seats',
          external: false,
        },
      });
      eventId = JSON.parse(eventResponse.payload).id;
    });

    test('should get seats for event', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}`,
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
    });

    test('should get seats with pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}&page=1&pageSize=10`,
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
      expect(payload.length).toBeLessThanOrEqual(10);
    });

    test('should validate pagination parameters', async () => {
      // Test invalid page size (too large)
      const response1 = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}&page=1&pageSize=25`,
      });
      expect(response1.statusCode).toBe(400);

      // Test invalid page (less than 1)
      const response2 = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}&page=0&pageSize=10`,
      });
      expect(response2.statusCode).toBe(400);
    });

    test('should require event_id parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/seats',
      });

      expect(response.statusCode).toBe(400);
    });

    test('should select seat for booking', async () => {
      // Create a booking first
      const bookingResponse = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          event_id: eventId,
        },
      });
      const bookingId = JSON.parse(bookingResponse.payload).id;

      // Get available seats
      const seatsResponse = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}&page=1&pageSize=1`,
      });
      const seats = JSON.parse(seatsResponse.payload);
      const availableSeat = seats.find((seat) => !seat.reserved);

      if (availableSeat) {
        const response = await app.inject({
          method: 'PATCH',
          url: '/api/seats/select',
          payload: {
            booking_id: bookingId,
            seat_id: availableSeat.id,
          },
        });

        expect(response.statusCode).toBe(200);
        expect(response.payload).toBe('"Seat successfully added to booking"');
      }
    });

    test('should release seat from booking', async () => {
      // Create a booking and select a seat first
      const bookingResponse = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          event_id: eventId,
        },
      });
      const bookingId = JSON.parse(bookingResponse.payload).id;

      // Get available seats
      const seatsResponse = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}&page=1&pageSize=1`,
      });
      const seats = JSON.parse(seatsResponse.payload);
      const availableSeat = seats.find((seat) => !seat.reserved);

      if (availableSeat) {
        // Select seat first
        await app.inject({
          method: 'PATCH',
          url: '/api/seats/select',
          payload: {
            booking_id: bookingId,
            seat_id: availableSeat.id,
          },
        });

        // Then release it
        const response = await app.inject({
          method: 'PATCH',
          url: '/api/seats/release',
          payload: {
            seat_id: availableSeat.id,
          },
        });

        expect(response.statusCode).toBe(200);
        expect(response.payload).toBe('"Seat successfully released"');
      }
    });
  });

  describe('Payments API', () => {
    let eventId, bookingId;

    beforeEach(async () => {
      // Create an event and booking for payment tests
      const eventResponse = await app.inject({
        method: 'POST',
        url: '/api/events',
        payload: {
          title: 'Test Concert for Payments',
          external: false,
        },
      });
      eventId = JSON.parse(eventResponse.payload).id;

      const bookingResponse = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          event_id: eventId,
        },
      });
      bookingId = JSON.parse(bookingResponse.payload).id;
    });

    test('should handle successful payment callback', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/payments/success?orderId=${bookingId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.payload).toBe('"OK"');
    });

    test('should handle failed payment callback', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/payments/fail?orderId=${bookingId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.payload).toBe('"OK"');
    });

    test('should validate payment callbacks with missing orderId', async () => {
      const successResponse = await app.inject({
        method: 'GET',
        url: '/api/payments/success',
      });
      expect(successResponse.statusCode).toBe(400);

      const failResponse = await app.inject({
        method: 'GET',
        url: '/api/payments/fail',
      });
      expect(failResponse.statusCode).toBe(400);
    });
  });
});
