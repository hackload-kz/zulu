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
  LoadTestOrchestrator,
  UserSimulator,
  PerformanceMonitor,
  generateLoadTestReport,
  getMemoryUsage,
} from './utils/stress-test-helpers.js';

describe('Comprehensive Stress Testing Suite', () => {
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

  test('Full system stress test - PRD compliance verification', async () => {
    console.log('Starting comprehensive system stress test...');
    console.log('This test verifies all PRD requirements under load');

    const startMemory = getMemoryUsage();
    const monitor = new PerformanceMonitor().start();

    // Create large event for testing
    const eventId = await createLargeEvent(
      app,
      'PRD Compliance Test - Mega Event',
      100000
    );

    const orchestrator = new LoadTestOrchestrator(app);

    // Scenario 1: Large event creation and management
    orchestrator.addScenario(
      'Large Event Management',
      [
        () => app.inject({ method: 'GET', url: '/api/events' }),
        () =>
          app.inject({
            method: 'GET',
            url: `/api/seats?event_id=${eventId}&page=1&pageSize=20`,
          }),
        () =>
          app.inject({
            method: 'GET',
            url: `/api/seats?event_id=${eventId}&page=5000&pageSize=20`,
          }),
      ],
      {
        concurrency: 200,
        requirements: {
          maxResponseTime: 2000,
          minSuccessRate: 0.95,
          maxErrorRate: 0.05,
        },
      }
    );

    // Scenario 2: Concurrent seat booking (scaled down for test performance)
    const concurrentUsers = 2000;
    const seatBookingOps = Array(concurrentUsers)
      .fill()
      .map(
        () => () =>
          app.inject({
            method: 'POST',
            url: '/api/bookings',
            payload: { event_id: eventId },
          })
      );

    orchestrator.addScenario('Concurrent Booking Creation', seatBookingOps, {
      concurrency: 300,
      delay: 1000,
      requirements: {
        maxResponseTime: 3000,
        minSuccessRate: 0.95,
        maxErrorRate: 0.05,
      },
    });

    // Scenario 3: Payment spike simulation
    const paymentOps = Array(1000)
      .fill()
      .map(
        (_, index) => () =>
          app.inject({
            method: 'GET',
            url: `/api/payments/success?orderId=${index + 1}`,
          })
      );

    orchestrator.addScenario('Payment Spike', paymentOps, {
      concurrency: 200,
      delay: 2000,
      requirements: {
        maxResponseTime: 1000,
        minSuccessRate: 0.9,
        maxErrorRate: 0.1,
      },
    });

    // Execute all scenarios
    const overallReport = await orchestrator.executeAll();
    const performanceReport = monitor.stop();
    const endMemory = getMemoryUsage();

    console.log('\n=== COMPREHENSIVE STRESS TEST REPORT ===');
    console.log(`Total Scenarios: ${overallReport.totalScenarios}`);
    console.log(`Total Operations: ${overallReport.summary.totalOperations}`);
    console.log(`Total Successful: ${overallReport.summary.totalSuccessful}`);
    console.log(`Total Errors: ${overallReport.summary.totalErrors}`);
    console.log(
      `Average Throughput: ${overallReport.summary.averageThroughput.toFixed(2)} ops/sec`
    );
    console.log(`Max Memory Usage: ${overallReport.summary.maxMemoryUsage}MB`);
    console.log(`Test Duration: ${performanceReport.duration}ms`);
    console.log(
      `Memory Increase: ${endMemory.heapUsed - startMemory.heapUsed}MB`
    );

    console.log('\nScenario Results:');
    overallReport.scenarioResults.forEach((scenario, index) => {
      console.log(`  ${index + 1}. ${scenario.scenario}:`);
      console.log(
        `     Success Rate: ${(scenario.results.successRate * 100).toFixed(2)}%`
      );
      console.log(
        `     Throughput: ${scenario.results.throughput.toFixed(2)} ops/sec`
      );
      console.log(
        `     Passed Requirements: ${scenario.report.passed ? 'YES' : 'NO'}`
      );

      if (!scenario.report.passed) {
        console.log(`     Issues: ${scenario.report.issues.join(', ')}`);
      }
    });

    // Verify PRD requirements
    const overallSuccessRate =
      overallReport.summary.totalSuccessful /
      overallReport.summary.totalOperations;
    const overallErrorRate =
      overallReport.summary.totalErrors / overallReport.summary.totalOperations;

    // PRD Requirement: Support up to 100,000 seats per event
    expect(eventId).toBeDefined();

    // PRD Requirement: Handle up to 10,000 concurrent users (scaled down for testing)
    expect(overallReport.summary.totalOperations).toBeGreaterThan(3000);

    // PRD Requirement: Performance and reliability under peak load
    expect(overallSuccessRate).toBeGreaterThan(0.9); // 90% overall success rate
    expect(overallErrorRate).toBeLessThan(0.1); // Less than 10% error rate
    expect(overallReport.summary.averageThroughput).toBeGreaterThan(50); // Minimum throughput

    // Memory efficiency requirement
    expect(overallReport.summary.maxMemoryUsage).toBeLessThan(2000); // Less than 2GB

    console.log('\n✅ PRD compliance verification completed!');

    // Verify each scenario passed its requirements
    const failedScenarios = overallReport.scenarioResults.filter(
      (s) => !s.report.passed
    );
    expect(failedScenarios.length).toBe(0);
  }, 600000); // 10 minute timeout

  test('Realistic user journey simulation - 1,000 users complete flow', async () => {
    console.log('Starting realistic user journey simulation...');

    const eventId = await createLargeEvent(
      app,
      'User Journey Test Concert',
      5000
    );

    const simulator = new UserSimulator(app, eventId);
    const userCount = 1000;

    console.log(`Simulating ${userCount} realistic user journeys...`);
    const userResults = await simulator.simulateMultipleUsers(userCount, 100);

    // Analyze user journey results
    const successfulUsers = userResults.filter((u) => u.success);
    const failedUsers = userResults.filter((u) => !u.success);

    // Analyze failure points
    const failuresByStep = {};
    failedUsers.forEach((user) => {
      const step = user.step || 'unknown';
      failuresByStep[step] = (failuresByStep[step] || 0) + 1;
    });

    // Analyze successful journey steps
    const stepSuccessRates = {};
    const allSteps = [
      'create_booking',
      'browse_seats',
      'select_seat',
      'initiate_payment',
      'payment_callback',
    ];

    allSteps.forEach((step) => {
      const stepAttempts = userResults.filter(
        (u) => u.actions && u.actions.some((a) => a.step === step)
      ).length;
      const stepSuccesses = userResults.filter(
        (u) =>
          u.actions &&
          u.actions.some((a) => a.step === step && a.statusCode === 200)
      ).length;

      stepSuccessRates[step] =
        stepAttempts > 0 ? stepSuccesses / stepAttempts : 0;
    });

    console.log('\n=== REALISTIC USER JOURNEY REPORT ===');
    console.log(`Total Users: ${userCount}`);
    console.log(`Successful Journeys: ${successfulUsers.length}`);
    console.log(`Failed Journeys: ${failedUsers.length}`);
    console.log(
      `Overall Success Rate: ${((successfulUsers.length / userCount) * 100).toFixed(2)}%`
    );

    console.log('\nStep Success Rates:');
    Object.entries(stepSuccessRates).forEach(([step, rate]) => {
      console.log(`  ${step}: ${(rate * 100).toFixed(2)}%`);
    });

    console.log('\nFailure Analysis:');
    Object.entries(failuresByStep).forEach(([step, count]) => {
      console.log(`  ${step}: ${count} failures`);
    });

    // Verify realistic user journey performance
    expect(successfulUsers.length / userCount).toBeGreaterThan(0.7); // At least 70% success rate
    expect(stepSuccessRates.create_booking).toBeGreaterThan(0.95); // 95% booking creation success
    expect(stepSuccessRates.browse_seats).toBeGreaterThan(0.95); // 95% seat browsing success

    // Payment success rate should reflect the 90% simulation rate
    const paymentSuccessRate =
      successfulUsers.filter(
        (u) =>
          u.actions &&
          u.actions.some(
            (a) => a.step === 'payment_callback' && a.paymentSuccess
          )
      ).length /
      userResults.filter(
        (u) => u.actions && u.actions.some((a) => a.step === 'payment_callback')
      ).length;

    expect(paymentSuccessRate).toBeGreaterThan(0.85); // Close to 90% payment success rate

    console.log('Realistic user journey simulation completed!');
  }, 300000); // 5 minute timeout

  test('System stability under extended load - 30 minute simulation', async () => {
    console.log('Starting extended load stability test...');
    console.log('Note: This is a compressed simulation of 30-minute load');

    const eventId = await createLargeEvent(
      app,
      'Extended Load Test Event',
      20000
    );

    const testDuration = 30000; // 30 seconds (compressed from 30 minutes)
    const operationsPerSecond = 50;
    const totalOperations = (testDuration / 1000) * operationsPerSecond;

    console.log(`Target: ${totalOperations} operations over ${testDuration}ms`);

    const monitor = new PerformanceMonitor().start();
    const startTime = Date.now();
    const results = [];

    // Generate continuous load
    while (Date.now() - startTime < testDuration) {
      const batchStartTime = Date.now();
      const batchOperations = [];

      // Create a batch of operations
      for (let i = 0; i < operationsPerSecond; i++) {
        const operationType = Math.random();

        if (operationType < 0.3) {
          // 30% seat browsing
          batchOperations.push(() =>
            app.inject({
              method: 'GET',
              url: `/api/seats?event_id=${eventId}&page=${Math.floor(Math.random() * 100) + 1}&pageSize=20`,
            })
          );
        } else if (operationType < 0.6) {
          // 30% booking creation
          batchOperations.push(() =>
            app.inject({
              method: 'POST',
              url: '/api/bookings',
              payload: { event_id: eventId },
            })
          );
        } else {
          // 40% payment callbacks
          const randomBookingId = Math.floor(Math.random() * 1000) + 1;
          const isSuccess = Math.random() < 0.8;
          const callbackUrl = isSuccess
            ? `/api/payments/success?orderId=${randomBookingId}`
            : `/api/payments/fail?orderId=${randomBookingId}`;

          batchOperations.push(() =>
            app.inject({
              method: 'GET',
              url: callbackUrl,
            })
          );
        }
      }

      // Execute batch
      const batchResults = await Promise.all(batchOperations.map((op) => op()));
      results.push(...batchResults);

      // Maintain target rate
      const batchDuration = Date.now() - batchStartTime;
      const targetBatchDuration = 1000; // 1 second

      if (batchDuration < targetBatchDuration) {
        await new Promise((resolve) =>
          setTimeout(resolve, targetBatchDuration - batchDuration)
        );
      }

      // Log progress every 5 seconds
      const elapsed = Date.now() - startTime;
      if (elapsed % 5000 < 100) {
        console.log(
          `Extended load progress: ${Math.round((elapsed / testDuration) * 100)}%`
        );
      }
    }

    const performanceReport = monitor.stop();
    const actualDuration = Date.now() - startTime;

    // Analyze stability
    const statusCodes = {};
    results.forEach((result) => {
      const code = result.statusCode;
      statusCodes[code] = (statusCodes[code] || 0) + 1;
    });

    const successRate = (statusCodes[200] || 0) / results.length;
    const errorRate =
      Object.keys(statusCodes)
        .filter((code) => parseInt(code) >= 400)
        .reduce((sum, code) => sum + statusCodes[code], 0) / results.length;

    const actualThroughput = results.length / (actualDuration / 1000);

    console.log('\n=== EXTENDED LOAD STABILITY REPORT ===');
    console.log(`Actual Duration: ${actualDuration}ms`);
    console.log(`Total Operations: ${results.length}`);
    console.log(`Target Operations: ${totalOperations}`);
    console.log(`Actual Throughput: ${actualThroughput.toFixed(2)} ops/sec`);
    console.log(`Target Throughput: ${operationsPerSecond} ops/sec`);
    console.log(`Success Rate: ${(successRate * 100).toFixed(2)}%`);
    console.log(`Error Rate: ${(errorRate * 100).toFixed(2)}%`);
    console.log(`Status Codes:`, statusCodes);
    console.log(`Memory Peak: ${performanceReport.memoryStats.peak}MB`);
    console.log(`Memory Average: ${performanceReport.memoryStats.average}MB`);

    // Verify system stability
    expect(results.length).toBeGreaterThan(totalOperations * 0.8); // At least 80% of target operations
    expect(successRate).toBeGreaterThan(0.85); // 85% success rate under extended load
    expect(errorRate).toBeLessThan(0.15); // Less than 15% error rate
    expect(actualThroughput).toBeGreaterThan(operationsPerSecond * 0.7); // At least 70% of target throughput

    // Verify memory stability (no significant leaks)
    expect(performanceReport.memoryStats.peak).toBeLessThan(1000); // Less than 1GB peak memory

    console.log('Extended load stability test completed!');
  }, 300000); // 5 minute timeout

  test('Error handling and recovery under stress', async () => {
    console.log('Starting error handling and recovery stress test...');

    const eventId = await createLargeEvent(
      app,
      'Error Handling Test Event',
      1000
    );

    // Create operations that mix valid and invalid requests
    const operations = [];

    // Valid operations (70%)
    for (let i = 0; i < 700; i++) {
      operations.push(() =>
        app.inject({
          method: 'POST',
          url: '/api/bookings',
          payload: { event_id: eventId },
        })
      );
    }

    // Invalid operations (30%) - should trigger error handling
    for (let i = 0; i < 300; i++) {
      const errorType = Math.floor(Math.random() * 4);

      switch (errorType) {
        case 0:
          // Invalid event ID
          operations.push(() =>
            app.inject({
              method: 'POST',
              url: '/api/bookings',
              payload: { event_id: 99999 },
            })
          );
          break;
        case 1:
          // Missing required fields
          operations.push(() =>
            app.inject({
              method: 'POST',
              url: '/api/bookings',
              payload: {},
            })
          );
          break;
        case 2:
          // Invalid seat selection
          operations.push(() =>
            app.inject({
              method: 'PATCH',
              url: '/api/seats/select',
              payload: {
                booking_id: 99999,
                seat_id: 99999,
              },
            })
          );
          break;
        case 3:
          // Invalid payment callback
          operations.push(() =>
            app.inject({
              method: 'GET',
              url: '/api/payments/success?orderId=invalid',
            })
          );
          break;
      }
    }

    // Shuffle operations to create realistic error distribution
    for (let i = operations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [operations[i], operations[j]] = [operations[j], operations[i]];
    }

    console.log(
      `Executing ${operations.length} operations with mixed valid/invalid requests...`
    );

    const testResults = await simulateConcurrentUsers(operations, 150);

    // Analyze error handling
    const validRequests = 700;
    const invalidRequests = 300;
    const successfulValid = testResults.statusCodes[201] || 0; // Bookings return 201
    const handled400s = testResults.statusCodes[400] || 0; // Bad requests
    const handled404s = testResults.statusCodes[404] || 0; // Not found
    const unhandledErrors = testResults.statusCodes[500] || 0; // Server errors

    console.log('\n=== ERROR HANDLING STRESS TEST REPORT ===');
    console.log(`Total Operations: ${testResults.totalOperations}`);
    console.log(`Valid Requests: ${validRequests}`);
    console.log(`Invalid Requests: ${invalidRequests}`);
    console.log(`Successful Valid Requests: ${successfulValid}`);
    console.log(`Handled 400 Errors: ${handled400s}`);
    console.log(`Handled 404 Errors: ${handled404s}`);
    console.log(`Unhandled 500 Errors: ${unhandledErrors}`);
    console.log(`Status Codes:`, testResults.statusCodes);
    console.log(`Throughput: ${testResults.throughput.toFixed(2)} ops/sec`);

    // Verify error handling requirements
    expect(testResults.totalOperations).toBe(1000);

    // Valid requests should mostly succeed
    expect(successfulValid / validRequests).toBeGreaterThan(0.8); // 80% of valid requests succeed

    // Invalid requests should be properly handled (not cause 500 errors)
    expect(unhandledErrors).toBeLessThan(invalidRequests * 0.1); // Less than 10% unhandled errors

    // Should properly return 400/404 for invalid requests
    expect(handled400s + handled404s).toBeGreaterThan(invalidRequests * 0.7); // At least 70% properly handled

    // System should maintain reasonable throughput even with errors
    expect(testResults.throughput).toBeGreaterThan(30); // At least 30 ops/sec

    console.log('Error handling and recovery stress test completed!');
  }, 180000); // 3 minute timeout
});
