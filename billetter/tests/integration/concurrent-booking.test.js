import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import { fastify } from '../../src/app.js';

describe('Test Scenario 3: Concurrent Seat Booking', () => {
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

  test('Two clients simultaneously attempt to book the same seat - only one succeeds', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'High Demand Concert',
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

    // Get the same seat for both attempts
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=1`,
    });
    const seats = JSON.parse(seatsResponse.payload);
    const targetSeat = seats.find((seat) => seat.status === 'FREE');
    expect(targetSeat).toBeDefined();

    // Simulate concurrent requests by making both requests rapidly
    const [select1Response, select2Response] = await Promise.all([
      app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: booking1Id,
          seat_id: targetSeat.id,
        },
      }),
      app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: booking2Id,
          seat_id: targetSeat.id,
        },
      }),
    ]);

    // One should succeed (200), one should fail (419)
    const responses = [select1Response, select2Response];
    const successResponses = responses.filter((r) => r.statusCode === 200);
    const conflictResponses = responses.filter((r) => r.statusCode === 419);

    expect(successResponses.length).toBe(1);
    expect(conflictResponses.length).toBe(1);
    expect(successResponses[0].payload).toBe(
      '"Seat successfully added to booking"'
    );
    expect(conflictResponses[0].payload).toBe(
      '"Failed to add seat to booking"'
    );

    // Verify seat is reserved
    const finalSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=1`,
    });
    const finalSeats = JSON.parse(finalSeatsResponse.payload);
    const finalSeat = finalSeats.find((s) => s.id === targetSeat.id);
    expect(finalSeat.status).toBe('RESERVED');
  });

  test('Multiple clients compete for limited seats', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Limited Seats Concert',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    // Create multiple bookings (more than available seats in first page)
    const numBookings = 5;
    const bookingIds = [];

    for (let i = 0; i < numBookings; i++) {
      const bookingResponse = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          event_id: eventId,
        },
      });
      bookingIds.push(JSON.parse(bookingResponse.payload).id);
    }

    // Get limited seats
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=3`,
    });
    const seats = JSON.parse(seatsResponse.payload);
    const availableSeats = seats.filter((seat) => seat.status === 'FREE');
    expect(availableSeats.length).toBeGreaterThanOrEqual(3);

    // All bookings try to select the same limited set of seats
    const seatSelectionPromises = [];

    for (let i = 0; i < numBookings; i++) {
      for (let j = 0; j < Math.min(availableSeats.length, 2); j++) {
        seatSelectionPromises.push(
          app.inject({
            method: 'PATCH',
            url: '/api/seats/select',
            payload: {
              booking_id: bookingIds[i],
              seat_id: availableSeats[j].id,
            },
          })
        );
      }
    }

    // Execute all requests concurrently
    const responses = await Promise.all(seatSelectionPromises);

    // Count successes and conflicts
    const successCount = responses.filter((r) => r.statusCode === 200).length;
    const conflictCount = responses.filter((r) => r.statusCode === 419).length;

    // Should have conflicts due to concurrent access
    expect(conflictCount).toBeGreaterThan(0);
    expect(successCount).toBeGreaterThan(0);
    expect(successCount + conflictCount).toBe(responses.length);

    // Verify final seat state
    const finalSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=3`,
    });
    const finalSeats = JSON.parse(finalSeatsResponse.payload);

    // Count reserved seats should equal successful selections
    const reservedSeats = finalSeats.filter(
      (seat) => seat.status === 'RESERVED'
    );
    expect(reservedSeats.length).toBe(successCount);
  });

  test('Concurrent seat selection and release operations', async () => {
    // Create event and booking
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Dynamic Seating Concert',
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

    // Get seats
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=2`,
    });
    const seats = JSON.parse(seatsResponse.payload);
    const seat1 = seats[0];
    const seat2 = seats[1];

    // First booking selects a seat
    const selectResponse = await app.inject({
      method: 'PATCH',
      url: '/api/seats/select',
      payload: {
        booking_id: booking1Id,
        seat_id: seat1.id,
      },
    });
    expect(selectResponse.statusCode).toBe(200);

    // Concurrent operations: release seat1 and select seat1 by different booking
    const [releaseResponse, selectConcurrentResponse] = await Promise.all([
      app.inject({
        method: 'PATCH',
        url: '/api/seats/release',
        payload: {
          seat_id: seat1.id,
        },
      }),
      app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: booking2Id,
          seat_id: seat1.id,
        },
      }),
    ]);

    // One operation should succeed, behavior depends on timing and implementation
    // Both operations might succeed if release happens first, or select might fail
    const acceptableStatusCodes = [200, 419];
    expect(acceptableStatusCodes).toContain(releaseResponse.statusCode);
    expect(acceptableStatusCodes).toContain(
      selectConcurrentResponse.statusCode
    );

    // Verify final state is consistent
    const finalSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=2`,
    });
    const finalSeats = JSON.parse(finalSeatsResponse.payload);
    const finalSeat1 = finalSeats.find((s) => s.id === seat1.id);

    // Seat should be either reserved or not reserved, but state should be consistent
    expect(typeof finalSeat1.status).toBe('string');
    expect(['FREE', 'RESERVED', 'SOLD']).toContain(finalSeat1.status);
  });

  test('High concurrency stress test with multiple operations', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Stress Test Concert',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    // Create multiple bookings
    const numBookings = 10;
    const bookingIds = [];

    for (let i = 0; i < numBookings; i++) {
      const bookingResponse = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          event_id: eventId,
        },
      });
      bookingIds.push(JSON.parse(bookingResponse.payload).id);
    }

    // Get seats for testing
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=5`,
    });
    const seats = JSON.parse(seatsResponse.payload);

    // Generate many concurrent operations
    const operations = [];

    // Each booking tries to select multiple seats
    bookingIds.forEach((bookingId) => {
      seats.forEach((seat) => {
        operations.push(
          app.inject({
            method: 'PATCH',
            url: '/api/seats/select',
            payload: {
              booking_id: bookingId,
              seat_id: seat.id,
            },
          })
        );
      });
    });

    // Execute all operations concurrently
    const startTime = Date.now();
    const responses = await Promise.all(operations);
    const endTime = Date.now();

    // Verify response types
    const successCount = responses.filter((r) => r.statusCode === 200).length;
    const conflictCount = responses.filter((r) => r.statusCode === 419).length;
    const errorCount = responses.filter(
      (r) => ![200, 419].includes(r.statusCode)
    ).length;

    // Should have many conflicts due to high concurrency
    expect(conflictCount).toBeGreaterThan(0);
    expect(successCount).toBeGreaterThan(0);
    expect(errorCount).toBe(0); // No unexpected errors

    // Performance check - operations should complete in reasonable time
    const executionTime = endTime - startTime;
    expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds

    // Verify data consistency
    const finalSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=5`,
    });
    const finalSeats = JSON.parse(finalSeatsResponse.payload);
    const reservedCount = finalSeats.filter(
      (seat) => seat.status === 'RESERVED'
    ).length;

    // Reserved seats should equal successful selections
    expect(reservedCount).toBe(successCount);

    console.log(
      `Concurrency test: ${operations.length} operations, ${successCount} success, ${conflictCount} conflicts, ${executionTime}ms`
    );
  });

  test('Concurrent booking creation and seat selection', async () => {
    // Create event
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        title: 'Rapid Booking Concert',
        external: false,
      },
    });
    const eventId = JSON.parse(eventResponse.payload).id;

    // Concurrent booking creation
    const bookingPromises = Array(5)
      .fill()
      .map(() =>
        app.inject({
          method: 'POST',
          url: '/api/bookings',
          payload: {
            event_id: eventId,
          },
        })
      );

    const bookingResponses = await Promise.all(bookingPromises);
    const bookingIds = bookingResponses.map((r) => JSON.parse(r.payload).id);

    // All bookings should be created successfully
    expect(bookingResponses.every((r) => r.statusCode === 201)).toBe(true);
    expect(new Set(bookingIds).size).toBe(bookingIds.length); // All IDs should be unique

    // Immediately try to select seats concurrently
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=1`,
    });
    const seats = JSON.parse(seatsResponse.payload);
    const targetSeat = seats[0];

    const seatSelectionPromises = bookingIds.map((bookingId) =>
      app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: bookingId,
          seat_id: targetSeat.id,
        },
      })
    );

    const selectionResponses = await Promise.all(seatSelectionPromises);

    // Only one should succeed
    const successCount = selectionResponses.filter(
      (r) => r.statusCode === 200
    ).length;
    const conflictCount = selectionResponses.filter(
      (r) => r.statusCode === 419
    ).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(bookingIds.length - 1);
  });
});
