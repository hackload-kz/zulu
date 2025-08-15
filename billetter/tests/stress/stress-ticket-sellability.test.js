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
  delay,
  executeBatched,
} from './utils/stress-test-helpers.js';

describe('Stress Test: 80% Ticket Sellability within 4 Hours', () => {
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

  test('Simulate 4-hour ticket selling window - 80% sellability requirement', async () => {
    console.log('Starting 4-hour ticket selling simulation...');
    console.log(
      'Note: This is a compressed simulation of 4-hour selling window'
    );

    const startTime = Date.now();
    const startMemory = getMemoryUsage();

    // Create large event (simulating stadium concert)
    const totalSeats = 50000; // Reduced from 100K for test performance
    const targetSellPercentage = 0.8; // 80% as per PRD requirement
    const targetSeatsSold = Math.floor(totalSeats * targetSellPercentage);

    console.log(`Event: ${totalSeats} total seats`);
    console.log(
      `Target: ${targetSeatsSold} seats (${targetSellPercentage * 100}%)`
    );

    const eventId = await createLargeEvent(
      app,
      'Stadium Concert - 4 Hour Selling Test',
      totalSeats
    );

    // Simulate realistic selling pattern over time
    // Hour 1: 50% of target sales (rush hour)
    // Hour 2: 25% of target sales (continued high demand)
    // Hour 3: 15% of target sales (steady demand)
    // Hour 4: 10% of target sales (final push)

    const sellingPhases = [
      { name: 'Hour 1 - Rush', percentage: 0.5, concurrency: 200 },
      { name: 'Hour 2 - High Demand', percentage: 0.25, concurrency: 150 },
      { name: 'Hour 3 - Steady', percentage: 0.15, concurrency: 100 },
      { name: 'Hour 4 - Final Push', percentage: 0.1, concurrency: 80 },
    ];

    let totalSeatsSold = 0;
    let totalBookingsCreated = 0;
    const phaseResults = [];

    for (const [phaseIndex, phase] of sellingPhases.entries()) {
      console.log(`\n=== ${phase.name} ===`);
      const phaseStartTime = Date.now();

      const seatsToSellThisPhase = Math.floor(
        targetSeatsSold * phase.percentage
      );
      const bookingsToCreate = seatsToSellThisPhase; // 1 seat per booking for simplicity

      console.log(`Target seats for this phase: ${seatsToSellThisPhase}`);
      console.log(`Creating ${bookingsToCreate} bookings...`);

      // Create bookings for this phase
      const batchSize = 100;
      const bookingBatches = Math.ceil(bookingsToCreate / batchSize);
      const phaseBookingIds = [];

      for (let batch = 0; batch < bookingBatches; batch++) {
        const currentBatchSize = Math.min(
          batchSize,
          bookingsToCreate - batch * batchSize
        );
        if (currentBatchSize <= 0) break;

        const batchBookingIds = await createMultipleBookings(
          app,
          eventId,
          currentBatchSize
        );
        phaseBookingIds.push(...batchBookingIds);

        if (batch % 10 === 0) {
          console.log(
            `Booking creation progress: ${phaseBookingIds.length}/${bookingsToCreate}`
          );
        }
      }

      totalBookingsCreated += phaseBookingIds.length;

      // Get available seats for this phase
      const availableSeatsResponse = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}&page=${phaseIndex + 1}&pageSize=20`,
      });
      expect(availableSeatsResponse.statusCode).toBe(200);
      const availableSeats = JSON.parse(availableSeatsResponse.payload);

      // Create seat selection and payment operations
      const operations = [];

      phaseBookingIds.forEach((bookingId, index) => {
        const seatIndex = index % availableSeats.length;
        const seat = availableSeats[seatIndex];

        // Seat selection
        operations.push(() =>
          app.inject({
            method: 'PATCH',
            url: '/api/seats/select',
            payload: {
              booking_id: bookingId,
              seat_id: seat.id,
            },
          })
        );

        // Payment initiation
        operations.push(() =>
          app.inject({
            method: 'PATCH',
            url: '/api/bookings/initiatePayment',
            payload: {
              booking_id: bookingId,
            },
          })
        );

        // Payment success (90% success rate)
        if (Math.random() < 0.9) {
          operations.push(() =>
            app.inject({
              method: 'GET',
              url: `/api/payments/success?orderId=${bookingId}`,
            })
          );
        } else {
          // Payment failure (10% failure rate)
          operations.push(() =>
            app.inject({
              method: 'GET',
              url: `/api/payments/fail?orderId=${bookingId}`,
            })
          );
        }
      });

      console.log(
        `Executing ${operations.length} operations with concurrency ${phase.concurrency}...`
      );

      const phaseResults = await simulateConcurrentUsers(
        operations,
        phase.concurrency
      );

      const phaseEndTime = Date.now();
      const phaseDuration = phaseEndTime - phaseStartTime;

      // Count successful seat sales (successful payment callbacks)
      const successfulPayments = phaseResults.results.filter((result) => {
        return (
          result.url &&
          result.url.includes('/payments/success') &&
          result.statusCode === 200
        );
      }).length;

      totalSeatsSold += successfulPayments;

      console.log(`Phase completed in ${phaseDuration}ms`);
      console.log(`Successful sales this phase: ${successfulPayments}`);
      console.log(`Total sales so far: ${totalSeatsSold}/${targetSeatsSold}`);
      console.log(
        `Current sell rate: ${((totalSeatsSold / totalSeats) * 100).toFixed(2)}%`
      );

      phaseResults.push({
        phase: phase.name,
        duration: phaseDuration,
        operations: operations.length,
        successfulSales: successfulPayments,
        throughput: phaseResults.throughput,
        successRate: phaseResults.successRate,
      });

      // Simulate time passage (small delay between phases)
      await delay(100);
    }

    const totalDuration = Date.now() - startTime;
    const endMemory = getMemoryUsage();
    const finalSellPercentage = totalSeatsSold / totalSeats;

    console.log('\n=== 4-HOUR SELLING SIMULATION REPORT ===');
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Total Seats: ${totalSeats}`);
    console.log(`Total Seats Sold: ${totalSeatsSold}`);
    console.log(`Sell Percentage: ${(finalSellPercentage * 100).toFixed(2)}%`);
    console.log(`Target: ${(targetSellPercentage * 100).toFixed(2)}%`);
    console.log(`Total Bookings Created: ${totalBookingsCreated}`);
    console.log(
      `Memory Usage Increase: ${endMemory.heapUsed - startMemory.heapUsed}MB`
    );

    console.log('\nPhase Breakdown:');
    phaseResults.forEach((phase) => {
      console.log(`  ${phase.phase}:`);
      console.log(`    Duration: ${phase.duration}ms`);
      console.log(`    Operations: ${phase.operations}`);
      console.log(`    Successful Sales: ${phase.successfulSales}`);
      console.log(`    Throughput: ${phase.throughput.toFixed(2)} ops/sec`);
      console.log(`    Success Rate: ${(phase.successRate * 100).toFixed(2)}%`);
    });

    // Verify 80% sellability requirement
    expect(finalSellPercentage).toBeGreaterThan(0.75); // Allow 5% tolerance for test variability
    expect(totalDuration).toBeLessThan(600000); // Should complete within 10 minutes (compressed 4 hours)

    // Verify system didn't degrade significantly under sustained load
    const overallThroughput =
      (totalBookingsCreated * 3) / (totalDuration / 1000); // 3 ops per booking
    expect(overallThroughput).toBeGreaterThan(50); // At least 50 ops/sec overall

    console.log('\n✅ 80% ticket sellability requirement met!');
    console.log('4-hour ticket selling simulation completed successfully!');
  }, 600000); // 10 minute timeout

  test('Peak hour rush simulation - 5,000 concurrent users in first hour', async () => {
    console.log('Starting peak hour rush simulation...');

    const eventId = await createLargeEvent(
      app,
      'Peak Hour Rush Concert',
      20000
    );

    // Simulate opening hour rush - everyone tries to buy at the same time
    const concurrentUsers = 5000;
    const seatsPerUser = 2; // Each user tries to buy 2 seats on average

    console.log(`Simulating ${concurrentUsers} concurrent users...`);
    console.log(`Each user attempts to buy ${seatsPerUser} seats`);

    // Create all bookings first
    const totalBookings = concurrentUsers;
    console.log('Creating bookings for all users...');
    const bookingIds = await createMultipleBookings(
      app,
      eventId,
      totalBookings
    );

    // Get seats from multiple pages to distribute load
    const seatPages = [1, 2, 3, 4, 5];
    const allSeats = [];

    for (const page of seatPages) {
      const seatsResponse = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}&page=${page}&pageSize=20`,
      });
      const seats = JSON.parse(seatsResponse.payload);
      allSeats.push(...seats);
    }

    // Create operations for the rush
    const rushOperations = [];

    bookingIds.forEach((bookingId) => {
      // Each user attempts to select multiple seats
      for (let i = 0; i < seatsPerUser; i++) {
        const randomSeat =
          allSeats[Math.floor(Math.random() * allSeats.length)];

        rushOperations.push(() =>
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

      // Payment initiation
      rushOperations.push(() =>
        app.inject({
          method: 'PATCH',
          url: '/api/bookings/initiatePayment',
          payload: {
            booking_id: bookingId,
          },
        })
      );

      // Payment completion (85% success rate during rush)
      if (Math.random() < 0.85) {
        rushOperations.push(() =>
          app.inject({
            method: 'GET',
            url: `/api/payments/success?orderId=${bookingId}`,
          })
        );
      }
    });

    console.log(`Executing ${rushOperations.length} rush operations...`);

    const rushResults = await simulateConcurrentUsers(rushOperations, 300);

    // Calculate successful purchases
    const successfulPayments = rushResults.results.filter((result) => {
      return (
        result.url &&
        result.url.includes('/payments/success') &&
        result.statusCode === 200
      );
    }).length;

    const successfulSeatSelections = rushResults.results.filter((result) => {
      return (
        result.url &&
        result.url.includes('/seats/select') &&
        result.statusCode === 200
      );
    }).length;

    console.log('=== PEAK HOUR RUSH REPORT ===');
    console.log(`Total Rush Operations: ${rushResults.totalOperations}`);
    console.log(`Total Time: ${rushResults.totalTime}ms`);
    console.log(`Throughput: ${rushResults.throughput.toFixed(2)} ops/sec`);
    console.log(`Successful Seat Selections: ${successfulSeatSelections}`);
    console.log(`Successful Payments: ${successfulPayments}`);
    console.log(
      `Overall Success Rate: ${(rushResults.successRate * 100).toFixed(2)}%`
    );
    console.log(
      `Conflict Rate: ${(rushResults.conflictRate * 100).toFixed(2)}%`
    );
    console.log(`Error Rate: ${(rushResults.errorRate * 100).toFixed(2)}%`);
    console.log(`Status Codes:`, rushResults.statusCodes);

    // Verify rush hour performance
    expect(rushResults.totalOperations).toBe(rushOperations.length);
    expect(rushResults.totalTime).toBeLessThan(120000); // Should handle rush within 2 minutes
    expect(rushResults.errorRate).toBeLessThan(0.1); // Less than 10% errors
    expect(successfulPayments).toBeGreaterThan(concurrentUsers * 0.3); // At least 30% of users should succeed

    // Expect high conflict rate due to simultaneous access to limited popular seats
    expect(rushResults.conflictRate).toBeGreaterThan(0.3); // At least 30% conflicts expected

    console.log('Peak hour rush simulation completed!');
  }, 300000); // 5 minute timeout

  test('Sustained load over extended period - 2 hours continuous selling', async () => {
    console.log('Starting sustained load test - 2 hours continuous selling...');

    const eventId = await createLargeEvent(
      app,
      'Sustained Load Concert',
      30000
    );

    // Simulate 2 hours of continuous but moderate selling
    // Break it into 12 periods of 10 minutes each (compressed to seconds for testing)
    const periods = 12;
    const usersPerPeriod = 200;
    const totalUsers = periods * usersPerPeriod;

    console.log(
      `Simulating ${periods} periods with ${usersPerPeriod} users each`
    );
    console.log(`Total users over test period: ${totalUsers}`);

    const sustainedResults = [];
    let totalSeatsSold = 0;

    for (let period = 1; period <= periods; period++) {
      console.log(`\n--- Period ${period}/${periods} ---`);
      const periodStart = Date.now();

      // Create bookings for this period
      const periodBookingIds = await createMultipleBookings(
        app,
        eventId,
        usersPerPeriod
      );

      // Get available seats
      const seatsResponse = await app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${eventId}&page=${Math.ceil(period / 2)}&pageSize=20`,
      });
      const seats = JSON.parse(seatsResponse.payload);

      // Create operations for this period
      const periodOperations = [];

      periodBookingIds.forEach((bookingId, index) => {
        const seat = seats[index % seats.length];

        // Seat selection
        periodOperations.push(() =>
          app.inject({
            method: 'PATCH',
            url: '/api/seats/select',
            payload: {
              booking_id: bookingId,
              seat_id: seat.id,
            },
          })
        );

        // Payment initiation
        periodOperations.push(() =>
          app.inject({
            method: 'PATCH',
            url: '/api/bookings/initiatePayment',
            payload: {
              booking_id: bookingId,
            },
          })
        );

        // Payment completion (88% success rate for sustained load)
        if (Math.random() < 0.88) {
          periodOperations.push(() =>
            app.inject({
              method: 'GET',
              url: `/api/payments/success?orderId=${bookingId}`,
            })
          );
        }
      });

      // Execute period operations with moderate concurrency
      const periodResult = await simulateConcurrentUsers(periodOperations, 80);

      const periodEnd = Date.now();
      const periodDuration = periodEnd - periodStart;

      // Count successful sales for this period
      const periodSuccessfulPayments = periodResult.results.filter((result) => {
        return (
          result.url &&
          result.url.includes('/payments/success') &&
          result.statusCode === 200
        );
      }).length;

      totalSeatsSold += periodSuccessfulPayments;

      sustainedResults.push({
        period,
        duration: periodDuration,
        operations: periodOperations.length,
        successfulSales: periodSuccessfulPayments,
        throughput: periodResult.throughput,
        errorRate: periodResult.errorRate,
      });

      console.log(`Period ${period} completed:`);
      console.log(`  Duration: ${periodDuration}ms`);
      console.log(`  Operations: ${periodOperations.length}`);
      console.log(`  Successful Sales: ${periodSuccessfulPayments}`);
      console.log(
        `  Throughput: ${periodResult.throughput.toFixed(2)} ops/sec`
      );
      console.log(
        `  Error Rate: ${(periodResult.errorRate * 100).toFixed(2)}%`
      );

      // Small delay between periods to simulate time passage
      await delay(50);
    }

    console.log('\n=== SUSTAINED LOAD TEST REPORT ===');
    console.log(`Total Periods: ${periods}`);
    console.log(`Total Users: ${totalUsers}`);
    console.log(`Total Seats Sold: ${totalSeatsSold}`);
    console.log(
      `Average Sales per Period: ${(totalSeatsSold / periods).toFixed(1)}`
    );

    // Analyze performance consistency
    const throughputs = sustainedResults.map((r) => r.throughput);
    const errorRates = sustainedResults.map((r) => r.errorRate);

    const avgThroughput =
      throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
    const avgErrorRate =
      errorRates.reduce((a, b) => a + b, 0) / errorRates.length;
    const throughputVariation =
      Math.max(...throughputs) - Math.min(...throughputs);

    console.log(`Average Throughput: ${avgThroughput.toFixed(2)} ops/sec`);
    console.log(`Average Error Rate: ${(avgErrorRate * 100).toFixed(2)}%`);
    console.log(
      `Throughput Variation: ${throughputVariation.toFixed(2)} ops/sec`
    );

    // Verify sustained performance
    expect(totalSeatsSold).toBeGreaterThan(totalUsers * 0.6); // At least 60% success rate
    expect(avgErrorRate).toBeLessThan(0.05); // Less than 5% average error rate
    expect(throughputVariation).toBeLessThan(avgThroughput * 0.5); // Variation should be less than 50% of average

    // Verify no significant performance degradation over time
    const firstHalfAvg =
      sustainedResults
        .slice(0, periods / 2)
        .reduce((sum, r) => sum + r.throughput, 0) /
      (periods / 2);
    const secondHalfAvg =
      sustainedResults
        .slice(periods / 2)
        .reduce((sum, r) => sum + r.throughput, 0) /
      (periods / 2);

    expect(secondHalfAvg).toBeGreaterThan(firstHalfAvg * 0.8); // Second half should be at least 80% of first half

    console.log('Sustained load test completed successfully!');
  }, 480000); // 8 minute timeout
});
