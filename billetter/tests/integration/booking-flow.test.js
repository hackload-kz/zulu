import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import { fastify } from '../../src/app.js';

describe('Test Scenario 1: Full Successful Booking Flow', () => {
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

  test('Complete booking flow: Create event → Create booking → Select seats → Initiate payment → Success notification → Booking confirmed', async () => {
    // Step 1: Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Celesta Moreira Concert',
        external: false,
      },
    });
    expect(eventResponse.statusCode).toBe(201);
    const eventId = JSON.parse(eventResponse.payload).id;

    // Step 2: Create booking
    const bookingResponse = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      payload: {
        event_id: eventId,
      },
    });
    expect(bookingResponse.statusCode).toBe(201);
    const bookingId = JSON.parse(bookingResponse.payload).id;

    // Step 3: Get available seats
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=5`,
    });
    expect(seatsResponse.statusCode).toBe(200);
    const seats = JSON.parse(seatsResponse.payload);
    expect(seats.length).toBeGreaterThan(0);

    // Step 4: Select multiple seats
    const availableSeats = seats
      .filter((seat) => seat.status === 'FREE')
      .slice(0, 3);
    expect(availableSeats.length).toBeGreaterThan(0);

    for (const seat of availableSeats) {
      const selectResponse = await app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: bookingId,
          seat_id: seat.id,
        },
      });
      expect(selectResponse.statusCode).toBe(200);
      expect(selectResponse.payload).toBe(
        '"Seat successfully added to booking"'
      );
    }

    // Step 5: Verify seats are now reserved
    const updatedSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=5`,
    });
    const updatedSeats = JSON.parse(updatedSeatsResponse.payload);
    for (const selectedSeat of availableSeats) {
      const seat = updatedSeats.find((s) => s.id === selectedSeat.id);
      expect(seat.status).toBe('RESERVED');
    }

    // Step 6: Initiate payment
    const paymentResponse = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/initiatePayment',
      payload: {
        booking_id: bookingId,
      },
    });
    expect(paymentResponse.statusCode).toBe(302);
    expect(paymentResponse.headers.location).toContain(
      `booking_id=${bookingId}`
    );

    // Step 7: Verify booking status is payment_initiated
    const bookingsResponse = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    expect(bookingsResponse.statusCode).toBe(200);
    const bookings = JSON.parse(bookingsResponse.payload);
    const booking = bookings.find((b) => b.id === bookingId);
    expect(booking.status).toBe('payment_initiated');

    // Step 8: Simulate successful payment callback
    const successResponse = await app.inject({
      method: 'GET',
      url: `/api/payments/success?orderId=${bookingId}`,
    });
    expect(successResponse.statusCode).toBe(200);
    expect(successResponse.payload).toBe('"OK"');

    // Step 9: Verify booking is confirmed
    const finalBookingsResponse = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    const finalBookings = JSON.parse(finalBookingsResponse.payload);
    const finalBooking = finalBookings.find((b) => b.id === bookingId);
    expect(finalBooking.status).toBe('confirmed');

    // Step 10: Verify seats remain reserved
    const finalSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=5`,
    });
    const finalSeats = JSON.parse(finalSeatsResponse.payload);
    for (const selectedSeat of availableSeats) {
      const seat = finalSeats.find((s) => s.id === selectedSeat.id);
      expect(seat.status).toBe('SOLD');
    }
  });

  test('Should handle booking flow with external event', async () => {
    // Create external event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'External Festival',
        external: true,
      },
    });
    expect(eventResponse.statusCode).toBe(201);
    const eventId = JSON.parse(eventResponse.payload).id;

    // Complete flow should work the same for external events
    const bookingResponse = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      payload: {
        event_id: eventId,
      },
    });
    expect(bookingResponse.statusCode).toBe(201);
    const bookingId = JSON.parse(bookingResponse.payload).id;

    // Verify event type is maintained
    const eventsResponse = await app.inject({
      method: 'GET',
      url: '/api/events',
    });
    const events = JSON.parse(eventsResponse.payload);
    const event = events.find((e) => e.id === eventId);
    expect(event.title).toBe('External Festival');
    // Note: external field might not be returned in GET response based on OpenAPI spec
  });

  test('Should prevent double booking of same seats', async () => {
    // Create event and booking
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Limited Seats Concert',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    const booking1Response = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      payload: {
        event_id: eventId,
      },
    });
    const booking1Id = JSON.parse(booking1Response.payload).id;

    const booking2Response = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      payload: {
        event_id: eventId,
      },
    });
    const booking2Id = JSON.parse(booking2Response.payload).id;

    // Get a seat
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=1`,
    });
    const seats = JSON.parse(seatsResponse.payload);
    const seat = seats[0];

    // First booking selects the seat
    const select1Response = await app.inject({
      method: 'PATCH',
      url: '/api/seats/select',
      payload: {
        booking_id: booking1Id,
        seat_id: seat.id,
      },
    });
    expect(select1Response.statusCode).toBe(200);

    // Second booking tries to select the same seat - should fail
    const select2Response = await app.inject({
      method: 'PATCH',
      url: '/api/seats/select',
      payload: {
        booking_id: booking2Id,
        seat_id: seat.id,
      },
    });
    expect(select2Response.statusCode).toBe(419);
    expect(select2Response.payload).toBe('"Failed to add seat to booking"');
  });
});
