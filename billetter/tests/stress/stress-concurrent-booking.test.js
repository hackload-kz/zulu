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
  createMultipleBookings,
  createLargeEvent,
  simulateConcurrentUsers,
  generateLoadTestReport,
  getMemoryUsage,
  executeBatched,
} from './utils/stress-test-helpers.js';

describe('Stress Test: Concurrent Seat Booking (10,000 Users)', () => {
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

  test('10,000 concurrent users attempting to book seats', async () => {
    console.log('Starting 10,000 concurrent user stress test...');
    const startMemory = getMemoryUsage();
    console.log('Initial memory usage:', startMemory);

    // Create large event with limited seats to increase contention
    const eventId = await createLargeEvent(
      app,
      'Celesta Moreira Concert - Stress Test',
      1000
    );

    // Create 1000 bookings (simulating 1000 real users, each making multiple requests)
    const userCount = 1000;
    const requestsPerUser = 10; // Each user tries 10 times

    console.log(`Creating ${userCount} bookings...`);
    const bookingIds = await createMultipleBookings(app, eventId, userCount);

    // Get some seats to target
    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=20`,
    });
    const seats = JSON.parse(seatsResponse.payload);
    expect(seats.length).toBeGreaterThan(0);

    // Create 10,000 concurrent seat selection operations
    const operations = [];

    for (let user = 0; user < userCount; user++) {
      for (let request = 0; request < requestsPerUser; request++) {
        const randomSeat = seats[Math.floor(Math.random() * seats.length)];
        const bookingId = bookingIds[user];

        operations.push(() =>
          app.inject({
            method: 'PATCH',
            url: '/api/seats/select',
            payload: {
              booking_id: bookingId,
              seat_id: randomSeat.id,
            },
          })
        );
      }
    }

    expect(operations.length).toBe(10000);
    console.log(
      `Executing ${operations.length} concurrent seat selection operations...`
    );

    // Execute all operations with controlled concurrency
    const testResults = await simulateConcurrentUsers(operations, 500);

    const endMemory = getMemoryUsage();
    console.log('Final memory usage:', endMemory);

    // Generate performance report
    const requirements = {
      maxResponseTime: 5000, // 5 seconds average
      minThroughput: 100, // 100 operations per second
      maxErrorRate: 0.1, // 10% error rate
      minSuccessRate: 0.1, // At least 10% should succeed (due to high contention)
    };

    const report = generateLoadTestReport(
      '10K Concurrent Users',
      testResults,
      requirements
    );

    console.log('=== STRESS TEST REPORT ===');
    console.log(`Test: ${report.testName}`);
    console.log(`Total Operations: ${testResults.totalOperations}`);
    console.log(`Total Time: ${testResults.totalTime}ms`);
    console.log(`Throughput: ${testResults.throughput.toFixed(2)} ops/sec`);
    console.log(`Success Rate: ${(testResults.successRate * 100).toFixed(2)}%`);
    console.log(
      `Conflict Rate: ${(testResults.conflictRate * 100).toFixed(2)}%`
    );
    console.log(`Error Rate: ${(testResults.errorRate * 100).toFixed(2)}%`);
    console.log(`Status Codes:`, testResults.statusCodes);
    console.log(`Memory Delta: ${endMemory.heapUsed - startMemory.heapUsed}MB`);

    if (!report.passed) {
      console.log('Issues:', report.issues);
    }

    // Verify test requirements
    expect(testResults.totalOperations).toBe(10000);
    expect(testResults.totalTime).toBeLessThan(60000); // Should complete within 1 minute
    expect(testResults.errorRate).toBeLessThan(0.1); // Less than 10% errors
    expect(testResults.successRate).toBeGreaterThan(0.05); // At least 5% success rate

    // Verify high contention scenario - should have many conflicts
    expect(testResults.conflictRate).toBeGreaterThan(0.5); // More than 50% conflicts due to limited seats

    // Verify no unexpected status codes
    const expectedCodes = ['200', '419', '400']; // Success, conflict, bad request
    Object.keys(testResults.statusCodes).forEach((code) => {
      expect(expectedCodes).toContain(code);
    });

    // Verify data consistency - check final seat state
    const finalSeatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=20`,
    });
    const finalSeats = JSON.parse(finalSeatsResponse.payload);
    const reservedSeats = finalSeats.filter((seat) => seat.status === 'RESERVED');

    // Reserved seats should not exceed successful operations
    expect(reservedSeats.length).toBeLessThanOrEqual(
      testResults.statusCodes['200'] || 0
    );

    console.log(`Final reserved seats: ${reservedSeats.length}`);
    console.log('Stress test completed successfully!');
  }, 120000); // 2 minute timeout

  test('Gradual load increase - ramping up to 5,000 concurrent operations', async () => {
    console.log('Starting gradual load increase test...');

    const eventId = await createLargeEvent(
      app,
      'Gradual Load Test Concert',
      500
    );
    const bookingIds = await createMultipleBookings(app, eventId, 100);

    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=10`,
    });
    const seats = JSON.parse(seatsResponse.payload);

    const loadLevels = [100, 500, 1000, 2500, 5000];
    const results = [];

    for (const loadLevel of loadLevels) {
      console.log(`Testing load level: ${loadLevel} operations`);

      const operations = Array(loadLevel)
        .fill()
        .map(() => {
          const randomSeat = seats[Math.floor(Math.random() * seats.length)];
          const randomBooking =
            bookingIds[Math.floor(Math.random() * bookingIds.length)];

          return () =>
            app.inject({
              method: 'PATCH',
              url: '/api/seats/select',
              payload: {
                booking_id: randomBooking,
                seat_id: randomSeat.id,
              },
            });
        });

      const testResult = await simulateConcurrentUsers(
        operations,
        Math.min(loadLevel, 200)
      );
      results.push({
        loadLevel,
        ...testResult,
      });

      console.log(
        `Load ${loadLevel}: ${testResult.throughput.toFixed(2)} ops/sec, ${(testResult.successRate * 100).toFixed(2)}% success`
      );

      // Reset seats for next test
      if (app.billetterService && app.billetterService.reset) {
        app.billetterService.reset();
      }
      await createLargeEvent(app, 'Gradual Load Test Concert', 500);
    }

    // Verify performance doesn't degrade too much under load
    const firstResult = results[0];
    const lastResult = results[results.length - 1];

    expect(lastResult.totalTime).toBeLessThan(firstResult.totalTime * 10); // Should not be 10x slower
    expect(lastResult.errorRate).toBeLessThan(0.2); // Error rate should stay reasonable

    console.log('Gradual load increase test completed!');
  }, 180000); // 3 minute timeout

  test('Burst load test - sudden spike in concurrent operations', async () => {
    console.log('Starting burst load test...');

    const eventId = await createLargeEvent(app, 'Burst Load Test Concert', 200);
    const bookingIds = await createMultipleBookings(app, eventId, 50);

    const seatsResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=10`,
    });
    const seats = JSON.parse(seatsResponse.payload);

    // Create sudden burst of 3000 operations
    const burstSize = 3000;
    const operations = Array(burstSize)
      .fill()
      .map(() => {
        const randomSeat = seats[Math.floor(Math.random() * seats.length)];
        const randomBooking =
          bookingIds[Math.floor(Math.random() * bookingIds.length)];

        return () =>
          app.inject({
            method: 'PATCH',
            url: '/api/seats/select',
            payload: {
              booking_id: randomBooking,
              seat_id: randomSeat.id,
            },
          });
      });

    console.log(`Executing burst of ${burstSize} operations...`);
    const startTime = Date.now();

    // Execute all operations as quickly as possible
    const batchSize = 100; // Small batches for maximum concurrency
    const results = await executeBatched(operations, batchSize);

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Analyze results
    const statusCodes = {};
    results.forEach((result) => {
      const code = result.statusCode;
      statusCodes[code] = (statusCodes[code] || 0) + 1;
    });

    const successRate = (statusCodes[200] || 0) / results.length;
    const errorRate =
      Object.keys(statusCodes)
        .filter((code) => !['200', '419'].includes(code))
        .reduce((sum, code) => sum + statusCodes[code], 0) / results.length;

    console.log(`Burst test completed in ${totalTime}ms`);
    console.log(`Success rate: ${(successRate * 100).toFixed(2)}%`);
    console.log(`Error rate: ${(errorRate * 100).toFixed(2)}%`);
    console.log(
      `Throughput: ${((results.length / totalTime) * 1000).toFixed(2)} ops/sec`
    );

    // Verify burst handling
    expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
    expect(errorRate).toBeLessThan(0.15); // Error rate should be manageable
    expect(results.length).toBe(burstSize);

    console.log('Burst load test completed!');
  }, 120000); // 2 minute timeout
});
