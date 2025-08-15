/**
 * Stress Testing Utilities for Billetter API
 */

/**
 * Batch execute promises with concurrency control
 * @param {Array<Function>} promiseFunctions - Array of functions that return promises
 * @param {number} batchSize - Number of concurrent operations
 * @returns {Promise<Array>} Results of all promises
 */
export async function executeBatched(promiseFunctions, batchSize = 100) {
  const results = [];

  for (let i = 0; i < promiseFunctions.length; i += batchSize) {
    const batch = promiseFunctions.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Execute promises with timing measurement
 * @param {Array<Function>} promiseFunctions - Array of functions that return promises
 * @param {number} concurrency - Number of concurrent operations
 * @returns {Promise<Object>} Results with timing information
 */
export async function executeWithTiming(promiseFunctions, concurrency = 100) {
  const startTime = Date.now();
  const results = await executeBatched(promiseFunctions, concurrency);
  const endTime = Date.now();

  return {
    results,
    totalTime: endTime - startTime,
    averageTime: (endTime - startTime) / promiseFunctions.length,
    throughput: (promiseFunctions.length / (endTime - startTime)) * 1000,
  };
}

/**
 * Create multiple bookings for stress testing
 * @param {Object} app - Fastify app instance
 * @param {number} eventId - Event ID
 * @param {number} count - Number of bookings to create
 * @returns {Promise<Array>} Array of booking IDs
 */
export async function createMultipleBookings(app, eventId, count) {
  const bookingPromises = Array(count)
    .fill()
    .map(() =>
      app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: { event_id: eventId },
      })
    );

  const responses = await Promise.all(bookingPromises);
  return responses.map((r) => JSON.parse(r.payload).id);
}

/**
 * Create a large event with many seats for stress testing
 * @param {Object} app - Fastify app instance
 * @param {string} title - Event title
 * @param {number} seatCount - Number of seats to create (will be distributed across rows)
 * @returns {Promise<number>} Event ID
 */
export async function createLargeEvent(app, title, seatCount = 100000) {
  const eventResponse = await app.inject({
    method: 'POST',
    url: '/api/events',
    payload: {
      title,
      external: false,
    },
  });

  const eventId = JSON.parse(eventResponse.payload).id;

  // The service should automatically create seats when an event is created
  // This is just to ensure the event exists
  return eventId;
}

/**
 * Measure pagination performance
 * @param {Object} app - Fastify app instance
 * @param {number} eventId - Event ID
 * @param {number} totalPages - Number of pages to test
 * @param {number} pageSize - Size of each page
 * @returns {Promise<Object>} Performance metrics
 */
export async function measurePaginationPerformance(
  app,
  eventId,
  totalPages,
  pageSize = 20
) {
  const times = [];

  for (let page = 1; page <= totalPages; page++) {
    const startTime = Date.now();

    const response = await app.inject({
      method: 'GET',
      url: `/api/seats?event_id=${eventId}&page=${page}&pageSize=${pageSize}`,
    });

    const endTime = Date.now();
    times.push(endTime - startTime);

    if (response.statusCode !== 200) {
      throw new Error(`Failed to fetch page ${page}: ${response.statusCode}`);
    }
  }

  return {
    averageTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    times,
  };
}

/**
 * Simulate concurrent users attempting operations
 * @param {Array<Function>} operationFactories - Functions that create operation promises
 * @param {number} concurrency - Number of concurrent operations
 * @returns {Promise<Object>} Results with statistics
 */
export async function simulateConcurrentUsers(
  operationFactories,
  concurrency = 1000
) {
  const startTime = Date.now();

  // Execute operations in batches to avoid overwhelming the system
  const batchSize = Math.min(concurrency, 100);
  const results = await executeBatched(operationFactories, batchSize);

  const endTime = Date.now();

  // Analyze results
  const statusCodes = {};
  results.forEach((result) => {
    const code = result.statusCode;
    statusCodes[code] = (statusCodes[code] || 0) + 1;
  });

  return {
    results,
    totalTime: endTime - startTime,
    totalOperations: results.length,
    throughput: (results.length / (endTime - startTime)) * 1000,
    statusCodes,
    successRate: (statusCodes[200] || 0) / results.length,
    conflictRate: (statusCodes[419] || 0) / results.length,
    errorRate:
      Object.keys(statusCodes)
        .filter((code) => !['200', '419'].includes(code))
        .reduce((sum, code) => sum + statusCodes[code], 0) / results.length,
  };
}

/**
 * Generate load test report
 * @param {string} testName - Name of the test
 * @param {Object} metrics - Test metrics
 * @param {Object} requirements - Performance requirements
 * @returns {Object} Test report
 */
export function generateLoadTestReport(testName, metrics, requirements = {}) {
  const report = {
    testName,
    timestamp: new Date().toISOString(),
    metrics,
    requirements,
    passed: true,
    issues: [],
  };

  // Check performance requirements
  if (
    requirements.maxResponseTime &&
    metrics.averageTime > requirements.maxResponseTime
  ) {
    report.passed = false;
    report.issues.push(
      `Average response time ${metrics.averageTime}ms exceeds requirement ${requirements.maxResponseTime}ms`
    );
  }

  if (
    requirements.minThroughput &&
    metrics.throughput < requirements.minThroughput
  ) {
    report.passed = false;
    report.issues.push(
      `Throughput ${metrics.throughput} ops/sec below requirement ${requirements.minThroughput} ops/sec`
    );
  }

  if (
    requirements.maxErrorRate &&
    metrics.errorRate > requirements.maxErrorRate
  ) {
    report.passed = false;
    report.issues.push(
      `Error rate ${(metrics.errorRate * 100).toFixed(2)}% exceeds requirement ${(requirements.maxErrorRate * 100).toFixed(2)}%`
    );
  }

  if (
    requirements.minSuccessRate &&
    metrics.successRate < requirements.minSuccessRate
  ) {
    report.passed = false;
    report.issues.push(
      `Success rate ${(metrics.successRate * 100).toFixed(2)}% below requirement ${(requirements.minSuccessRate * 100).toFixed(2)}%`
    );
  }

  return report;
}

/**
 * Memory usage monitoring utility
 * @returns {Object} Memory usage statistics
 */
export function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
  };
}

/**
 * Performance metrics collector
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = [];
    this.startTime = null;
    this.intervals = [];
  }

  start() {
    this.startTime = Date.now();
    this.metrics = [];

    // Collect metrics every second
    const interval = setInterval(() => {
      this.collectMetrics();
    }, 1000);

    this.intervals.push(interval);
    return this;
  }

  stop() {
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];
    return this.getReport();
  }

  collectMetrics() {
    const timestamp = Date.now();
    const memory = getMemoryUsage();

    this.metrics.push({
      timestamp,
      timeElapsed: timestamp - this.startTime,
      memory,
      cpuUsage: process.cpuUsage(),
    });
  }

  getReport() {
    if (this.metrics.length === 0) return null;

    const memoryUsages = this.metrics.map((m) => m.memory.heapUsed);
    const maxMemory = Math.max(...memoryUsages);
    const minMemory = Math.min(...memoryUsages);
    const avgMemory =
      memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;

    return {
      duration: this.metrics[this.metrics.length - 1].timeElapsed,
      memoryStats: {
        max: maxMemory,
        min: minMemory,
        average: Math.round(avgMemory),
        peak: maxMemory - minMemory,
      },
      sampleCount: this.metrics.length,
      rawMetrics: this.metrics,
    };
  }
}

/**
 * Load test orchestrator for complex scenarios
 */
export class LoadTestOrchestrator {
  constructor(app) {
    this.app = app;
    this.scenarios = [];
    this.results = [];
  }

  addScenario(name, operations, options = {}) {
    this.scenarios.push({
      name,
      operations,
      concurrency: options.concurrency || 100,
      delay: options.delay || 0,
      requirements: options.requirements || {},
    });
    return this;
  }

  async executeAll() {
    console.log(`Executing ${this.scenarios.length} load test scenarios...`);

    for (const [index, scenario] of this.scenarios.entries()) {
      console.log(`\n[${index + 1}/${this.scenarios.length}] ${scenario.name}`);

      if (scenario.delay > 0) {
        console.log(`Waiting ${scenario.delay}ms before scenario...`);
        await delay(scenario.delay);
      }

      const monitor = new PerformanceMonitor().start();
      const results = await simulateConcurrentUsers(
        scenario.operations,
        scenario.concurrency
      );
      const performanceReport = monitor.stop();

      const report = generateLoadTestReport(
        scenario.name,
        results,
        scenario.requirements
      );

      this.results.push({
        scenario: scenario.name,
        results,
        performanceReport,
        report,
      });

      console.log(
        `Scenario completed: ${(results.successRate * 100).toFixed(2)}% success rate`
      );
    }

    return this.generateOverallReport();
  }

  generateOverallReport() {
    const overallReport = {
      totalScenarios: this.scenarios.length,
      scenarioResults: this.results,
      summary: {
        totalOperations: 0,
        totalSuccessful: 0,
        totalErrors: 0,
        averageThroughput: 0,
        maxMemoryUsage: 0,
      },
    };

    // Calculate summary statistics
    this.results.forEach((result) => {
      overallReport.summary.totalOperations += result.results.totalOperations;
      overallReport.summary.totalSuccessful +=
        result.results.statusCodes['200'] || 0;
      overallReport.summary.totalErrors += result.results.results.filter(
        (r) => r.statusCode >= 400
      ).length;
      overallReport.summary.maxMemoryUsage = Math.max(
        overallReport.summary.maxMemoryUsage,
        result.performanceReport?.memoryStats?.max || 0
      );
    });

    overallReport.summary.averageThroughput =
      this.results.reduce((sum, r) => sum + r.results.throughput, 0) /
      this.results.length;

    return overallReport;
  }
}

/**
 * Realistic user simulation with think time
 */
export class UserSimulator {
  constructor(app, eventId) {
    this.app = app;
    this.eventId = eventId;
    this.thinkTimeMs = 1000; // 1 second think time between actions
  }

  async simulateUser(userId) {
    const actions = [];

    try {
      // Create booking
      const bookingResponse = await this.app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: { event_id: this.eventId },
      });

      if (bookingResponse.statusCode !== 201) {
        return {
          userId,
          success: false,
          step: 'create_booking',
          statusCode: bookingResponse.statusCode,
        };
      }

      const bookingId = JSON.parse(bookingResponse.payload).id;
      actions.push({
        step: 'create_booking',
        statusCode: bookingResponse.statusCode,
      });

      await delay(this.thinkTimeMs);

      // Browse seats
      const seatsResponse = await this.app.inject({
        method: 'GET',
        url: `/api/seats?event_id=${this.eventId}&page=1&pageSize=20`,
      });

      if (seatsResponse.statusCode !== 200) {
        return {
          userId,
          success: false,
          step: 'browse_seats',
          statusCode: seatsResponse.statusCode,
          actions,
        };
      }

      const seats = JSON.parse(seatsResponse.payload);
      actions.push({
        step: 'browse_seats',
        statusCode: seatsResponse.statusCode,
      });

      await delay(this.thinkTimeMs);

      // Select seat
      const randomSeat = seats[Math.floor(Math.random() * seats.length)];
      const selectSeatResponse = await this.app.inject({
        method: 'PATCH',
        url: '/api/seats/select',
        payload: {
          booking_id: bookingId,
          seat_id: randomSeat.id,
        },
      });

      actions.push({
        step: 'select_seat',
        statusCode: selectSeatResponse.statusCode,
      });

      if (selectSeatResponse.statusCode !== 200) {
        return {
          userId,
          success: false,
          step: 'select_seat',
          statusCode: selectSeatResponse.statusCode,
          actions,
        };
      }

      await delay(this.thinkTimeMs);

      // Initiate payment
      const paymentResponse = await this.app.inject({
        method: 'PATCH',
        url: '/api/bookings/initiatePayment',
        payload: { booking_id: bookingId },
      });

      actions.push({
        step: 'initiate_payment',
        statusCode: paymentResponse.statusCode,
      });

      if (paymentResponse.statusCode !== 200) {
        return {
          userId,
          success: false,
          step: 'initiate_payment',
          statusCode: paymentResponse.statusCode,
          actions,
        };
      }

      await delay(this.thinkTimeMs);

      // Complete payment (90% success rate)
      const paymentSuccess = Math.random() < 0.9;
      const paymentCallbackUrl = paymentSuccess
        ? `/api/payments/success?orderId=${bookingId}`
        : `/api/payments/fail?orderId=${bookingId}`;

      const callbackResponse = await this.app.inject({
        method: 'GET',
        url: paymentCallbackUrl,
      });

      actions.push({
        step: 'payment_callback',
        statusCode: callbackResponse.statusCode,
        paymentSuccess,
      });

      return {
        userId,
        success: paymentSuccess && callbackResponse.statusCode === 200,
        bookingId,
        actions,
      };
    } catch (error) {
      return { userId, success: false, error: error.message, actions };
    }
  }

  async simulateMultipleUsers(userCount, concurrency = 50) {
    console.log(
      `Simulating ${userCount} realistic users with ${this.thinkTimeMs}ms think time...`
    );

    const userSimulations = Array(userCount)
      .fill()
      .map((_, index) => () => this.simulateUser(index + 1));

    return await executeBatched(userSimulations, concurrency);
  }
}

/**
 * Wait for a specified duration
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry operation with exponential backoff
 * @param {Function} operation - Operation to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise<any>} Result of the operation
 */
export async function retryWithBackoff(
  operation,
  maxRetries = 3,
  baseDelay = 100
) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      const delayMs = baseDelay * Math.pow(2, attempt);
      await delay(delayMs);
    }
  }

  throw lastError;
}
