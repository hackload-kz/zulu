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
  measurePaginationPerformance,
  generateLoadTestReport,
  getMemoryUsage,
  simulateConcurrentUsers,
  createMultipleBookings,
  delay,
} from './utils/stress-test-helpers.js';

describe('Stress Test: Large Events (100,000 Seats)', () => {
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

  test('Create and manage 100,000 seat event', async () => {
    console.log('Starting 100,000 seat event creation test...');
    const startMemory = getMemoryUsage();
    console.log('Initial memory usage:', startMemory);

    const startTime = Date.now();

    // Create large event with 100,000 seats (as per PRD requirements)
    const eventId = await createLargeEvent(
      app,
      'Celesta Moreira Mega Concert - 100K Seats',
      100000
    );

    const eventCreationTime = Date.now() - startTime;
    console.log(`Event creation time: ${eventCreationTime}ms`);

    // Verify event was created
    const eventsResponse = await app.inject({
      method: 'GET',
      url: '/api/events',
    });
    expect(eventsResponse.statusCode).toBe(200);
    const events = JSON.parse(eventsResponse.payload);
    const createdEvent = events.find((e) => e.id === eventId);
    expect(createdEvent).toBeDefined();
    expect(createdEvent.title).toBe(
      'Celesta Moreira Mega Concert - 100K Seats'
    );

    // Test seat count verification - check first and last pages
    const firstPageResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=1&pageSize=20`,
    });
    expect(firstPageResponse.statusCode).toBe(200);
    const firstPageSeats = JSON.parse(firstPageResponse.payload);
    expect(firstPageSeats.length).toBe(20);

    // Calculate total pages (100,000 seats / 20 per page = 5,000 pages)
    const totalPages = Math.ceil(100000 / 20);
    const lastPageResponse = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=${totalPages}&pageSize=20`,
    });
    expect(lastPageResponse.statusCode).toBe(200);
    const lastPageSeats = JSON.parse(lastPageResponse.payload);
    expect(lastPageSeats.length).toBeGreaterThan(0);

    const endMemory = getMemoryUsage();
    console.log('Memory after event creation:', endMemory);
    console.log(
      `Memory increase: ${endMemory.heapUsed - startMemory.heapUsed}MB`
    );

    // Verify memory usage is reasonable for 100K seats
    const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
    expect(memoryIncrease).toBeLessThan(1000); // Should not use more than 1GB

    console.log('100,000 seat event creation test completed!');
  }, 60000); // 1 minute timeout

  test('Pagination performance with 100,000 seats', async () => {
    console.log('Starting pagination performance test...');

    const eventId = await createLargeEvent(
      app,
      'Pagination Performance Test',
      100000
    );

    // Test pagination performance for different page sizes
    const pageSizes = [10, 20]; // Keep it reasonable for testing
    const pagesPerSize = 50; // Test 50 pages per size

    for (const pageSize of pageSizes) {
      console.log(`Testing pagination with page size ${pageSize}...`);

      const metrics = await measurePaginationPerformance(
        app,
        eventId,
        pagesPerSize,
        pageSize
      );

      console.log(`Page size ${pageSize} metrics:`);
      console.log(`  Average time: ${metrics.averageTime}ms`);
      console.log(`  Min time: ${metrics.minTime}ms`);
      console.log(`  Max time: ${metrics.maxTime}ms`);

      // Verify pagination performance requirements
      expect(metrics.averageTime).toBeLessThan(1000); // Should respond within 1 second
      expect(metrics.maxTime).toBeLessThan(5000); // No single request should take more than 5 seconds

      // Verify response time consistency (max should not be more than 10x average)
      expect(metrics.maxTime).toBeLessThan(metrics.averageTime * 10);
    }

    console.log('Pagination performance test completed!');
  }, 120000); // 2 minute timeout

  test('Concurrent access to large event - 5,000 simultaneous users', async () => {
    console.log('Starting concurrent access test for large event...');

    const eventId = await createLargeEvent(
      app,
      'Concurrent Access Test - 100K Seats',
      100000
    );

    // Create operations that simulate concurrent users browsing seats
    const userCount = 5000;
    const operations = [];

    // Generate random page accesses across the large seat range
    for (let i = 0; i < userCount; i++) {
      const randomPage = Math.floor(Math.random() * 1000) + 1; // Random page from 1-1000
      const pageSize = 20;

      operations.push(() =>
        app.inject({
          method: 'GET',
          url: `/api/seats?event_id=${eventId}&page=${randomPage}&pageSize=${pageSize}`,
        })
      );
    }

    console.log(
      `Executing ${operations.length} concurrent seat list operations...`
    );

    const testResults = await simulateConcurrentUsers(operations, 200);

    // Generate performance report
    const requirements = {
      maxResponseTime: 3000, // 3 seconds average
      minThroughput: 100, // 100 operations per second
      maxErrorRate: 0.05, // 5% error rate
      minSuccessRate: 0.95, // 95% success rate
    };

    const report = generateLoadTestReport(
      '5K Concurrent Users - Large Event',
      testResults,
      requirements
    );

    console.log('=== LARGE EVENT CONCURRENT ACCESS REPORT ===');
    console.log(`Test: ${report.testName}`);
    console.log(`Total Operations: ${testResults.totalOperations}`);
    console.log(`Total Time: ${testResults.totalTime}ms`);
    console.log(`Throughput: ${testResults.throughput.toFixed(2)} ops/sec`);
    console.log(`Success Rate: ${(testResults.successRate * 100).toFixed(2)}%`);
    console.log(`Error Rate: ${(testResults.errorRate * 100).toFixed(2)}%`);
    console.log(`Status Codes:`, testResults.statusCodes);

    if (!report.passed) {
      console.log('Issues:', report.issues);
    }

    // Verify test requirements
    expect(testResults.totalOperations).toBe(5000);
    expect(testResults.successRate).toBeGreaterThan(0.9); // 90% success rate
    expect(testResults.errorRate).toBeLessThan(0.1); // Less than 10% errors

    console.log('Concurrent access test completed!');
  }, 180000); // 3 minute timeout

  test('Memory efficiency with multiple large events', async () => {
    console.log('Starting memory efficiency test...');

    const initialMemory = getMemoryUsage();
    console.log('Initial memory usage:', initialMemory);

    const events = [];
    const eventCount = 5;
    const seatsPerEvent = 20000; // 5 events × 20K seats = 100K total seats

    // Create multiple large events
    for (let i = 0; i < eventCount; i++) {
      console.log(`Creating event ${i + 1} of ${eventCount}...`);

      const eventId = await createLargeEvent(
        app,
        `Memory Test Event ${i + 1}`,
        seatsPerEvent
      );
      events.push(eventId);

      const currentMemory = getMemoryUsage();
      console.log(`Memory after event ${i + 1}:`, currentMemory);

      // Allow garbage collection between events
      if (global.gc) {
        global.gc();
      }
      await delay(100);
    }

    const finalMemory = getMemoryUsage();
    console.log('Final memory usage:', finalMemory);

    const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryPerEvent = totalMemoryIncrease / eventCount;

    console.log(`Total memory increase: ${totalMemoryIncrease}MB`);
    console.log(`Average memory per event: ${memoryPerEvent}MB`);

    // Verify memory usage is reasonable
    expect(totalMemoryIncrease).toBeLessThan(2000); // Should not use more than 2GB total
    expect(memoryPerEvent).toBeLessThan(400); // Should not use more than 400MB per 20K seat event

    // Test access to all events to ensure they're still functional
    for (const eventId of events) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}&page=1&pageSize=10`,
      });
      expect(response.statusCode).toBe(200);
      const seats = JSON.parse(response.payload);
      expect(seats.length).toBe(10);
    }

    console.log('Memory efficiency test completed!');
  }, 300000); // 5 minute timeout

  test('Seat selection performance on large event', async () => {
    console.log('Starting seat selection performance test on large event...');

    const eventId = await createLargeEvent(
      app,
      'Seat Selection Performance Test',
      50000
    );

    // Create bookings for the test
    const bookingCount = 1000;
    console.log(`Creating ${bookingCount} bookings...`);
    const bookingIds = await createMultipleBookings(app, eventId, bookingCount);

    // Get seats from different parts of the event (beginning, middle, end)
    const seatRequests = [
      { page: 1, pageSize: 20 }, // Beginning
      { page: 1250, pageSize: 20 }, // Middle (50K/20 = 2500 pages, so 1250 is middle)
      { page: 2500, pageSize: 20 }, // End
    ];

    const allSeats = [];
    for (const req of seatRequests) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}&page=${req.page}&pageSize=${req.pageSize}`,
      });
      expect(response.statusCode).toBe(200);
      const seats = JSON.parse(response.payload);
      allSeats.push(...seats);
    }

    // Create seat selection operations across the large seat range
    const operationCount = 2000;
    const operations = [];

    for (let i = 0; i < operationCount; i++) {
      const randomSeat = allSeats[Math.floor(Math.random() * allSeats.length)];
      const randomBooking =
        bookingIds[Math.floor(Math.random() * bookingIds.length)];

      operations.push(() =>
        app.inject({
          method: 'PATCH',
          url: '/api/seats/select',
          payload: {
            booking_id: randomBooking,
            seat_id: randomSeat.id,
          },
        })
      );
    }

    console.log(`Executing ${operations.length} seat selection operations...`);

    const testResults = await simulateConcurrentUsers(operations, 100);

    console.log('=== SEAT SELECTION PERFORMANCE REPORT ===');
    console.log(`Total Operations: ${testResults.totalOperations}`);
    console.log(`Total Time: ${testResults.totalTime}ms`);
    console.log(`Throughput: ${testResults.throughput.toFixed(2)} ops/sec`);
    console.log(`Success Rate: ${(testResults.successRate * 100).toFixed(2)}%`);
    console.log(
      `Conflict Rate: ${(testResults.conflictRate * 100).toFixed(2)}%`
    );
    console.log(`Error Rate: ${(testResults.errorRate * 100).toFixed(2)}%`);

    // Verify performance requirements
    expect(testResults.totalOperations).toBe(operationCount);
    expect(testResults.errorRate).toBeLessThan(0.1); // Less than 10% errors
    expect(testResults.throughput).toBeGreaterThan(50); // At least 50 ops/sec

    console.log('Seat selection performance test completed!');
  }, 240000); // 4 minute timeout
});
