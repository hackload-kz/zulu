import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import { fastify } from '../../src/app.js';

describe('Test Scenario 4: Unsuccessful Payments and Rollbacks', () => {
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

  test('Failed payment releases seats and cancels booking', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Payment Failure Concert',
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

    // Select multiple seats
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=5`,
    });
    const seats = JSON.parse(seatsResponse.payload);
    const availableSeats = seats
      .filter((seat) => seat.status === 'FREE')
      .slice(0, 3);

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
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=5`,
    });
    const reservedSeats = JSON.parse(reservedSeatsResponse.payload);
    for (const selectedSeat of availableSeats) {
      const seat = reservedSeats.find((s) => s.id === selectedSeat.id);
      expect(seat.status).toBe('RESERVED');
    }

    // Initiate payment
    const paymentResponse = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/initiatePayment',
      payload: {
        booking_id: bookingId,
      },
    });
    expect(paymentResponse.statusCode).toBe(302);

    // Verify booking is in payment_initiated status
    const paymentBookingsResponse = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    const paymentBookings = JSON.parse(paymentBookingsResponse.payload);
    const paymentBooking = paymentBookings.find((b) => b.id === bookingId);
    expect(paymentBooking.status).toBe('payment_initiated');

    // Simulate payment failure
    const failResponse = await app.inject({
      method: 'GET',
      url: `/api/payments/fail?orderId=${bookingId}`,
    });
    expect(failResponse.statusCode).toBe(200);
    expect(failResponse.payload).toBe('"OK"');

    // Verify booking is cancelled
    const finalBookingsResponse = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    const finalBookings = JSON.parse(finalBookingsResponse.payload);
    const cancelledBooking = finalBookings.find((b) => b.id === bookingId);
    expect(cancelledBooking.status).toBe('cancelled');

    // Verify all seats are released
    const releasedSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=5`,
    });
    const releasedSeats = JSON.parse(releasedSeatsResponse.payload);
    for (const selectedSeat of availableSeats) {
      const seat = releasedSeats.find((s) => s.id === selectedSeat.id);
      expect(seat.status).toBe('FREE');
    }
  });

  test('Payment failure is idempotent', async () => {
    // Create event and booking
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Idempotent Failure Concert',
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

    // Select seat and initiate payment
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

    await app.inject({
      method: 'PATCH',
      url: '/api/bookings/initiatePayment',
      payload: {
        booking_id: bookingId,
      },
    });

    // First payment failure
    const fail1Response = await app.inject({
      method: 'GET',
      url: `/api/payments/fail?orderId=${bookingId}`,
    });
    expect(fail1Response.statusCode).toBe(200);

    // Second payment failure (idempotent)
    const fail2Response = await app.inject({
      method: 'GET',
      url: `/api/payments/fail?orderId=${bookingId}`,
    });
    expect(fail2Response.statusCode).toBe(200);
    expect(fail2Response.payload).toBe('"OK"');

    // Booking should remain cancelled
    const bookingsResponse = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    const bookings = JSON.parse(bookingsResponse.payload);
    const booking = bookings.find((b) => b.id === bookingId);
    expect(booking.status).toBe('cancelled');

    // Seat should remain released
    const finalSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=1`,
    });
    const finalSeats = JSON.parse(finalSeatsResponse.payload);
    const finalSeat = finalSeats.find((s) => s.id === seat.id);
    expect(finalSeat.status).toBe('FREE');
  });

  test('Failed payment allows seats to be selected by other bookings', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Seat Reallocation Concert',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    // Create two bookings
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

    // First booking selects seats and initiates payment
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=2`,
    });
    const seats = JSON.parse(seatsResponse.payload);
    const targetSeats = seats.slice(0, 2);

    for (const seat of targetSeats) {
      await app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: booking1Id,
          seat_id: seat.id,
        },
      });
    }

    await app.inject({
      method: 'PATCH',
      url: '/api/bookings/initiatePayment',
      payload: {
        booking_id: booking1Id,
      },
    });

    // Payment fails for first booking
    await app.inject({
      method: 'GET',
      url: `/api/payments/fail?orderId=${booking1Id}`,
    });

    // Second booking should now be able to select the same seats
    for (const seat of targetSeats) {
      const selectResponse = await app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: booking2Id,
          seat_id: seat.id,
        },
      });
      expect(selectResponse.statusCode).toBe(200);
      expect(selectResponse.payload).toBe(
        '"Seat successfully added to booking"'
      );
    }

    // Verify seats are now reserved for second booking
    const finalSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=2`,
    });
    const finalSeats = JSON.parse(finalSeatsResponse.payload);
    for (const targetSeat of targetSeats) {
      const seat = finalSeats.find((s) => s.id === targetSeat.id);
      expect(seat.status).toBe('RESERVED');
    }
  });

  test('Payment failure after successful payment should have no effect', async () => {
    // Create event and booking
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Post-Success Failure Concert',
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

    // Complete successful booking flow
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

    await app.inject({
      method: 'PATCH',
      url: '/api/bookings/initiatePayment',
      payload: {
        booking_id: bookingId,
      },
    });

    // Successful payment
    const successResponse = await app.inject({
      method: 'GET',
      url: `/api/payments/success?orderId=${bookingId}`,
    });
    expect(successResponse.statusCode).toBe(200);

    // Verify booking is confirmed
    const confirmedBookingsResponse = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    const confirmedBookings = JSON.parse(confirmedBookingsResponse.payload);
    const confirmedBooking = confirmedBookings.find((b) => b.id === bookingId);
    expect(confirmedBooking.status).toBe('confirmed');

    // Attempt payment failure after success - should be ignored
    const failResponse = await app.inject({
      method: 'GET',
      url: `/api/payments/fail?orderId=${bookingId}`,
    });
    expect(failResponse.statusCode).toBe(200);
    expect(failResponse.payload).toBe('"OK"');

    // Booking should remain confirmed
    const finalBookingsResponse = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    const finalBookings = JSON.parse(finalBookingsResponse.payload);
    const finalBooking = finalBookings.find((b) => b.id === bookingId);
    expect(finalBooking.status).toBe('confirmed');

    // Seat should remain reserved
    const finalSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=1`,
    });
    const finalSeats = JSON.parse(finalSeatsResponse.payload);
    const finalSeat = finalSeats.find((s) => s.id === seat.id);
    expect(finalSeat.status).toBe('SOLD');
  });

  test('Multiple rapid payment failure attempts', async () => {
    // Create event and booking
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Rapid Failure Concert',
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

    // Setup booking with seats and payment
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=3`,
    });
    const seats = JSON.parse(seatsResponse.payload);
    const selectedSeats = seats.slice(0, 3);

    for (const seat of selectedSeats) {
      await app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: bookingId,
          seat_id: seat.id,
        },
      });
    }

    await app.inject({
      method: 'PATCH',
      url: '/api/bookings/initiatePayment',
      payload: {
        booking_id: bookingId,
      },
    });

    // Multiple concurrent payment failure attempts
    const failurePromises = Array(5)
      .fill()
      .map(() =>
        app.inject({
          method: 'GET',
          url: `/api/payments/fail?orderId=${bookingId}`,
        })
      );

    const failureResponses = await Promise.all(failurePromises);

    // All should return success (idempotent)
    failureResponses.forEach((response) => {
      expect(response.statusCode).toBe(200);
      expect(response.payload).toBe('"OK"');
    });

    // Final state should be consistent
    const finalBookingsResponse = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    const finalBookings = JSON.parse(finalBookingsResponse.payload);
    const finalBooking = finalBookings.find((b) => b.id === bookingId);
    expect(finalBooking.status).toBe('cancelled');

    // All seats should be released
    const finalSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=3`,
    });
    const finalSeats = JSON.parse(finalSeatsResponse.payload);
    for (const selectedSeat of selectedSeats) {
      const seat = finalSeats.find((s) => s.id === selectedSeat.id);
      expect(seat.status).toBe('FREE');
    }
  });

  test('Payment failure with invalid booking ID', async () => {
    // Attempt payment failure with non-existent booking
    const failResponse = await app.inject({
      method: 'GET',
      url: '/api/payments/fail?orderId=99999',
    });

    // Should handle gracefully - either 404 or 200 depending on implementation
    const acceptableStatusCodes = [200, 404];
    expect(acceptableStatusCodes).toContain(failResponse.statusCode);
  });

  test('Concurrent payment success and failure attempts', async () => {
    // Create event and booking
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Concurrent Payment Concert',
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

    // Setup booking
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

    await app.inject({
      method: 'PATCH',
      url: '/api/bookings/initiatePayment',
      payload: {
        booking_id: bookingId,
      },
    });

    // Concurrent success and failure attempts
    const [successResponse, failResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: `/api/payments/success?orderId=${bookingId}`,
      }),
      app.inject({
        method: 'GET',
        url: `/api/payments/fail?orderId=${bookingId}`,
      }),
    ]);

    // Both should return 200 (idempotent)
    expect(successResponse.statusCode).toBe(200);
    expect(failResponse.statusCode).toBe(200);

    // Final state should be deterministic (likely success wins)
    const finalBookingsResponse = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    const finalBookings = JSON.parse(finalBookingsResponse.payload);
    const finalBooking = finalBookings.find((b) => b.id === bookingId);

    // Should be either confirmed or cancelled, but consistent
    expect(['confirmed', 'cancelled']).toContain(finalBooking.status);

    // Seat state should match booking state
    const finalSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=1`,
    });
    const finalSeats = JSON.parse(finalSeatsResponse.payload);
    const finalSeat = finalSeats.find((s) => s.id === seat.id);

    if (finalBooking.status === 'confirmed') {
      expect(finalSeat.status).toBe('SOLD');
    } else {
      expect(finalSeat.status).toBe('FREE');
    }
  });
});
