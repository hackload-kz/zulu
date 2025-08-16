import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import { fastify } from '../../src/app.js';
import {
  createLargeEvent,
  createMultipleBookings,
  simulateConcurrentUsers,
  generateLoadTestReport,
  getMemoryUsage,
  executeBatched,
  delay,
} from './utils/stress-test-helpers.js';

describe('Stress Test: Payment Spike Scenarios', () => {
  let app;

  beforeAll(async () => {
    app = fastify;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    if (app.billetterService && app.billetterService.reset) {
      app.billetterService.reset();
    }
  });

  test('Massive concurrent payment initiation - 5,000 simultaneous payments', async () => {
    console.log('Starting massive concurrent payment initiation test...');
    const startMemory = getMemoryUsage();

    // Create event and bookings
    const eventId = await createLargeEvent(
      app,
      'Payment Spike Test Event',
      10000
    );
    const bookingCount = 5000;
    console.log(`Creating ${bookingCount} bookings...`);
    const bookingIds = await createMultipleBookings(app, eventId, bookingCount);

    // Get seats for selection
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=20`,
    });
    const seats = JSON.parse(seatsResponse.payload);

    // Select seats for all bookings first
    console.log('Selecting seats for all bookings...');
    const seatSelectionOperations = bookingIds.map((bookingId, index) => {
      const seat = seats[index % seats.length]; // Distribute seats
      return () =>
        app.inject({
          method: 'PATCH',
          url: '/api/seats/select',
          payload: {
            booking_id: bookingId,
            seat_id: seat.id,
          },
        });
    });

    await executeBatched(seatSelectionOperations, 200);

    // Now create payment initiation operations
    const paymentOperations = bookingIds.map(
      (bookingId) => () =>
        app.inject({
          method: 'PATCH',
          url: '/api/bookings/initiatePayment',
          payload: {
            booking_id: bookingId,
          },
        })
    );

    console.log(
      `Executing ${paymentOperations.length} concurrent payment initiations...`
    );

    const testResults = await simulateConcurrentUsers(paymentOperations, 300);

    const endMemory = getMemoryUsage();

    // Generate performance report
    const requirements = {
      maxResponseTime: 2000, // 2 seconds average
      minThroughput: 200, // 200 operations per second
      maxErrorRate: 0.05, // 5% error rate
      minSuccessRate: 0.95, // 95% success rate
    };

    const report = generateLoadTestReport(
      'Payment Spike - 5K Concurrent',
      testResults,
      requirements
    );

    console.log('=== PAYMENT SPIKE STRESS TEST REPORT ===');
    console.log(`Test: ${report.testName}`);
    console.log(`Total Operations: ${testResults.totalOperations}`);
    console.log(`Total Time: ${testResults.totalTime}ms`);
    console.log(`Throughput: ${testResults.throughput.toFixed(2)} ops/sec`);
    console.log(`Success Rate: ${(testResults.successRate * 100).toFixed(2)}%`);
    console.log(`Error Rate: ${(testResults.errorRate * 100).toFixed(2)}%`);
    console.log(`Status Codes:`, testResults.statusCodes);
    console.log(`Memory Delta: ${endMemory.heapUsed - startMemory.heapUsed}MB`);

    if (!report.passed) {
      console.log('Issues:', report.issues);
    }

    // Verify test requirements
    expect(testResults.totalOperations).toBe(5000);
    expect(testResults.successRate).toBeGreaterThan(0.9); // 90% success rate
    expect(testResults.errorRate).toBeLessThan(0.1); // Less than 10% errors
    expect(testResults.totalTime).toBeLessThan(60000); // Should complete within 1 minute

    console.log('Payment spike test completed!');
  }, 180000); // 3 minute timeout

  test('Payment success/failure callback storm - 3,000 concurrent callbacks', async () => {
    console.log('Starting payment callback storm test...');

    // Create event and complete booking flow for multiple bookings
    const eventId = await createLargeEvent(app, 'Callback Storm Test', 5000);
    const bookingCount = 3000;
    const bookingIds = await createMultipleBookings(app, eventId, bookingCount);

    // Get seats and select them
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=20`,
    });
    const seats = JSON.parse(seatsResponse.payload);

    // Select seats and initiate payments for all bookings
    console.log('Setting up bookings for payment callbacks...');
    for (let i = 0; i < bookingIds.length; i++) {
      const bookingId = bookingIds[i];
      const seat = seats[i % seats.length];

      // Select seat
      await app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: bookingId,
          seat_id: seat.id,
        },
      });

      // Initiate payment
      await app.inject({
        method: 'PATCH',
        url: '/api/bookings/initiatePayment',
        payload: {
          booking_id: bookingId,
        },
      });

      // Add small delay to avoid overwhelming the system during setup
      if (i % 100 === 0) {
        await delay(10);
        console.log(`Setup progress: ${i}/${bookingIds.length}`);
      }
    }

    // Create mixed success/failure callback operations
    const callbackOperations = [];

    bookingIds.forEach((bookingId, index) => {
      // 70% success, 30% failure to simulate realistic payment outcomes
      const isSuccess = Math.random() < 0.7;

      const callbackUrl = isSuccess
        ? `/api/payments/success?orderId=${bookingId}`
        : `/api/payments/fail?orderId=${bookingId}`;

      callbackOperations.push(() =>
        app.inject({
          method: 'GET',
          url: callbackUrl,
        })
      );
    });

    console.log(
      `Executing ${callbackOperations.length} concurrent payment callbacks...`
    );
    console.log('Expected: ~70% success callbacks, ~30% failure callbacks');

    const testResults = await simulateConcurrentUsers(callbackOperations, 200);

    // Analyze results
    const successCallbacks = testResults.results.filter(
      (r) => r.statusCode === 200
    ).length;
    const errorCallbacks = testResults.results.filter(
      (r) => r.statusCode !== 200
    ).length;

    console.log('=== PAYMENT CALLBACK STORM REPORT ===');
    console.log(`Total Callbacks: ${testResults.totalOperations}`);
    console.log(`Successful Callbacks: ${successCallbacks}`);
    console.log(`Failed Callbacks: ${errorCallbacks}`);
    console.log(`Total Time: ${testResults.totalTime}ms`);
    console.log(
      `Throughput: ${testResults.throughput.toFixed(2)} callbacks/sec`
    );
    console.log(`Success Rate: ${(testResults.successRate * 100).toFixed(2)}%`);
    console.log(`Error Rate: ${(testResults.errorRate * 100).toFixed(2)}%`);

    // Verify callback processing
    expect(testResults.totalOperations).toBe(3000);
    expect(testResults.successRate).toBeGreaterThan(0.95); // 95% of callbacks should be processed successfully
    expect(testResults.totalTime).toBeLessThan(90000); // Should complete within 1.5 minutes

    console.log('Payment callback storm test completed!');
  }, 300000); // 5 minute timeout

  test('Payment timeout and rollback under heavy load', async () => {
    console.log('Starting payment timeout and rollback stress test...');

    const eventId = await createLargeEvent(app, 'Payment Timeout Test', 2000);
    const bookingCount = 1000;
    const bookingIds = await createMultipleBookings(app, eventId, bookingCount);

    // Setup bookings with seats and initiate payments
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=20`,
    });
    const seats = JSON.parse(seatsResponse.payload);

    console.log('Setting up bookings for timeout test...');
    const setupOperations = bookingIds.map((bookingId, index) => {
      const seat = seats[index % seats.length];
      return async () => {
        // Select seat
        await app.inject({
          method: 'PATCH',
          url: '/api/seats/select',
          payload: {
            booking_id: bookingId,
            seat_id: seat.id,
          },
        });

        // Initiate payment
        await app.inject({
          method: 'PATCH',
          url: '/api/bookings/initiatePayment',
          payload: {
            booking_id: bookingId,
          },
        });
      };
    });

    await executeBatched(setupOperations, 50);

    // Now simulate payment failures (rollbacks) for all bookings simultaneously
    const rollbackOperations = bookingIds.map(
      (bookingId) => () =>
        app.inject({
          method: 'GET',
          url: `/api/payments/fail?orderId=${bookingId}`,
        })
    );

    console.log(
      `Executing ${rollbackOperations.length} concurrent payment rollbacks...`
    );

    const rollbackResults = await simulateConcurrentUsers(
      rollbackOperations,
      150
    );

    console.log('=== PAYMENT ROLLBACK STRESS TEST REPORT ===');
    console.log(`Total Rollbacks: ${rollbackResults.totalOperations}`);
    console.log(`Total Time: ${rollbackResults.totalTime}ms`);
    console.log(
      `Throughput: ${rollbackResults.throughput.toFixed(2)} rollbacks/sec`
    );
    console.log(
      `Success Rate: ${(rollbackResults.successRate * 100).toFixed(2)}%`
    );
    console.log(`Error Rate: ${(rollbackResults.errorRate * 100).toFixed(2)}%`);

    // Verify all rollbacks were processed
    expect(rollbackResults.totalOperations).toBe(1000);
    expect(rollbackResults.successRate).toBeGreaterThan(0.95); // 95% successful rollbacks
    expect(rollbackResults.totalTime).toBeLessThan(60000); // Should complete within 1 minute

    // Verify data consistency - all seats should be released after rollbacks
    console.log('Verifying seat release consistency...');
    const finalSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=20`,
    });
    const finalSeats = JSON.parse(finalSeatsResponse.payload);
    const reservedSeats = finalSeats.filter((seat) => seat.status === 'RESERVED');

    console.log(`Reserved seats after rollback: ${reservedSeats.length}`);
    expect(reservedSeats.length).toBe(0); // All seats should be released

    console.log('Payment timeout and rollback test completed!');
  }, 240000); // 4 minute timeout

  test('Mixed payment operations under extreme load', async () => {
    console.log('Starting mixed payment operations extreme load test...');

    const eventId = await createLargeEvent(
      app,
      'Mixed Payment Load Test',
      3000
    );
    const bookingCount = 2000;
    const bookingIds = await createMultipleBookings(app, eventId, bookingCount);

    // Get seats for operations
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=20`,
    });
    const seats = JSON.parse(seatsResponse.payload);

    // Create mixed operations: seat selection, payment initiation, and callbacks
    const mixedOperations = [];

    bookingIds.forEach((bookingId, index) => {
      const seat = seats[index % seats.length];

      // Seat selection operation
      mixedOperations.push(() =>
        app.inject({
          method: 'PATCH',
          url: '/api/seats/select',
          payload: {
            booking_id: bookingId,
            seat_id: seat.id,
          },
        })
      );

      // Payment initiation operation
      mixedOperations.push(() =>
        app.inject({
          method: 'PATCH',
          url: '/api/bookings/initiatePayment',
          payload: {
            booking_id: bookingId,
          },
        })
      );

      // Payment callback operation (random success/failure)
      const isSuccess = Math.random() < 0.8;
      const callbackUrl = isSuccess
        ? `/api/payments/success?orderId=${bookingId}`
        : `/api/payments/fail?orderId=${bookingId}`;

      mixedOperations.push(() =>
        app.inject({
          method: 'GET',
          url: callbackUrl,
        })
      );
    });

    // Shuffle operations to create realistic mixed load
    for (let i = mixedOperations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mixedOperations[i], mixedOperations[j]] = [
        mixedOperations[j],
        mixedOperations[i],
      ];
    }

    console.log(
      `Executing ${mixedOperations.length} mixed payment operations...`
    );

    const testResults = await simulateConcurrentUsers(mixedOperations, 100);

    console.log('=== MIXED PAYMENT OPERATIONS REPORT ===');
    console.log(`Total Operations: ${testResults.totalOperations}`);
    console.log(`Total Time: ${testResults.totalTime}ms`);
    console.log(`Throughput: ${testResults.throughput.toFixed(2)} ops/sec`);
    console.log(`Success Rate: ${(testResults.successRate * 100).toFixed(2)}%`);
    console.log(`Error Rate: ${(testResults.errorRate * 100).toFixed(2)}%`);
    console.log(`Status Codes:`, testResults.statusCodes);

    // Verify mixed load handling
    expect(testResults.totalOperations).toBe(6000); // 3 ops per booking × 2000 bookings
    expect(testResults.errorRate).toBeLessThan(0.15); // Less than 15% errors (due to race conditions)
    expect(testResults.totalTime).toBeLessThan(120000); // Should complete within 2 minutes

    console.log('Mixed payment operations test completed!');
  }, 300000); // 5 minute timeout
});
