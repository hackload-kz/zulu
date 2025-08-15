import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import { fastify } from '../src/app.js';

describe('Test Scenario 2: Cancel Booking at Various Stages', () => {
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

  test('Cancel booking before seat selection', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Concert for Early Cancellation',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    // Create booking
    const bookingResponse = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      payload: {
        event_id: eventId,
      },
    });
    expect(bookingResponse.statusCode).toBe(201);
    const bookingId = JSON.parse(bookingResponse.payload).id;

    // Verify booking exists and is in 'booked' status
    const initialBookingsResponse = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    const initialBookings = JSON.parse(initialBookingsResponse.payload);
    const initialBooking = initialBookings.find((b) => b.id === bookingId);
    expect(initialBooking.status).toBe('booked');

    // Cancel booking
    const cancelResponse = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/cancel',
      payload: {
        booking_id: bookingId,
      },
    });
    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.payload).toBe('"Booking successfully cancelled"');

    // Verify booking status is cancelled
    const finalBookingsResponse = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    const finalBookings = JSON.parse(finalBookingsResponse.payload);
    const cancelledBooking = finalBookings.find((b) => b.id === bookingId);
    expect(cancelledBooking.status).toBe('cancelled');
  });

  test('Cancel booking after seat selection', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Concert for Mid Cancellation',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    // Create booking
    const bookingResponse = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      payload: {
        event_id: eventId,
      },
    });
    const bookingId = JSON.parse(bookingResponse.payload).id;

    // Get and select seats
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=3`,
    });
    const seats = JSON.parse(seatsResponse.payload);
    const availableSeats = seats.filter((seat) => !seat.reserved).slice(0, 2);

    // Select multiple seats
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
    }

    // Verify seats are reserved
    const reservedSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=3`,
    });
    const reservedSeats = JSON.parse(reservedSeatsResponse.payload);
    for (const selectedSeat of availableSeats) {
      const seat = reservedSeats.find((s) => s.id === selectedSeat.id);
      expect(seat.reserved).toBe(true);
    }

    // Cancel booking
    const cancelResponse = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/cancel',
      payload: {
        booking_id: bookingId,
      },
    });
    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.payload).toBe('"Booking successfully cancelled"');

    // Verify booking status is cancelled
    const bookingsResponse = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    const bookings = JSON.parse(bookingsResponse.payload);
    const cancelledBooking = bookings.find((b) => b.id === bookingId);
    expect(cancelledBooking.status).toBe('cancelled');

    // Verify all seats are released
    const finalSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=3`,
    });
    const finalSeats = JSON.parse(finalSeatsResponse.payload);
    for (const selectedSeat of availableSeats) {
      const seat = finalSeats.find((s) => s.id === selectedSeat.id);
      expect(seat.reserved).toBe(false);
    }
  });

  test('Cancel booking after payment initiation but before confirmation', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Concert for Late Cancellation',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    // Create booking
    const bookingResponse = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      payload: {
        event_id: eventId,
      },
    });
    const bookingId = JSON.parse(bookingResponse.payload).id;

    // Select seats
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=2`,
    });
    const seats = JSON.parse(seatsResponse.payload);
    const availableSeats = seats.filter((seat) => !seat.reserved);

    for (const seat of availableSeats) {
      await app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: bookingId,
          seat_id: seat.id,
        },
      });
    }

    // Initiate payment
    const paymentResponse = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/initiatePayment',
      payload: {
        booking_id: bookingId,
      },
    });
    expect(paymentResponse.statusCode).toBe(200);

    // Verify booking is in payment_initiated status
    const paymentBookingsResponse = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    const paymentBookings = JSON.parse(paymentBookingsResponse.payload);
    const paymentBooking = paymentBookings.find((b) => b.id === bookingId);
    expect(paymentBooking.status).toBe('payment_initiated');

    // Cancel booking during payment phase
    const cancelResponse = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/cancel',
      payload: {
        booking_id: bookingId,
      },
    });
    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.payload).toBe('"Booking successfully cancelled"');

    // Verify booking status is cancelled
    const finalBookingsResponse = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    const finalBookings = JSON.parse(finalBookingsResponse.payload);
    const cancelledBooking = finalBookings.find((b) => b.id === bookingId);
    expect(cancelledBooking.status).toBe('cancelled');

    // Verify all seats are released
    const finalSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=2`,
    });
    const finalSeats = JSON.parse(finalSeatsResponse.payload);
    for (const selectedSeat of availableSeats) {
      const seat = finalSeats.find((s) => s.id === selectedSeat.id);
      expect(seat.reserved).toBe(false);
    }
  });

  test('Should not allow cancellation of already confirmed booking', async () => {
    // Create event and complete full booking flow
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Concert for Confirmed Booking',
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

    // Select a seat
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=1`,
    });
    const seats = JSON.parse(seatsResponse.payload);
    const seat = seats[0];

    await app.inject({
      method: 'PATCH',
      url: '/api/seats/select',
      payload: {
        booking_id: bookingId,
        seat_id: seat.id,
      },
    });

    // Initiate and confirm payment
    await app.inject({
      method: 'PATCH',
      url: '/api/bookings/initiatePayment',
      payload: {
        booking_id: bookingId,
      },
    });

    await app.inject({
      method: 'GET',
      url: `/api/payments/success?orderId=${bookingId}`,
    });

    // Try to cancel confirmed booking - should fail or have no effect
    const cancelResponse = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/cancel',
      payload: {
        booking_id: bookingId,
      },
    });

    // Implementation should either return 400/409 or ignore the request
    // Since PRD doesn't specify, we'll accept either behavior
    const acceptableStatusCodes = [200, 400, 409];
    expect(acceptableStatusCodes).toContain(cancelResponse.statusCode);

    // If cancellation was allowed (status 200), booking should remain confirmed
    if (cancelResponse.statusCode === 200) {
      const bookingsResponse = await app.inject({
        method: 'GET',
        url: '/api/bookings',
      });
      const bookings = JSON.parse(bookingsResponse.payload);
      const booking = bookings.find((b) => b.id === bookingId);
      expect(booking.status).toBe('confirmed');
    }
  });

  test('Should handle multiple rapid cancellation attempts', async () => {
    // Create event and booking
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Concert for Rapid Cancellation',
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

    // First cancellation should succeed
    const cancel1Response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/cancel',
      payload: {
        booking_id: bookingId,
      },
    });
    expect(cancel1Response.statusCode).toBe(200);

    // Second cancellation should be idempotent or return error
    const cancel2Response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/cancel',
      payload: {
        booking_id: bookingId,
      },
    });

    // Either idempotent (200) or error (400/409)
    const acceptableStatusCodes = [200, 400, 409];
    expect(acceptableStatusCodes).toContain(cancel2Response.statusCode);

    // Booking should remain cancelled
    const bookingsResponse = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    const bookings = JSON.parse(bookingsResponse.payload);
    const booking = bookings.find((b) => b.id === bookingId);
    expect(booking.status).toBe('cancelled');
  });
});
