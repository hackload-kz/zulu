# Stress Testing Guide

This document describes the comprehensive stress testing suite for the Billetter API, designed to validate compliance with all PRD requirements under extreme load conditions.

## Test Organization

Stress tests are **physically and logically separated** from unit/integration tests:

```
tests/
├── integration/          # Unit & integration tests (npm test)
│   ├── billetter-api.test.js
│   ├── booking-flow.test.js
│   └── ...
├── stress/              # Stress tests (npm run test:stress)
│   ├── utils/
│   │   └── stress-test-helpers.js
│   ├── stress-concurrent-booking.test.js
│   ├── stress-large-events.test.js
│   ├── stress-payment-spike.test.js
│   ├── stress-ticket-sellability.test.js
│   └── stress-comprehensive.test.js
└── utils/               # Integration test utilities
```

## PRD Requirements Validation

The stress tests verify the following PRD requirements:

- ✅ **Support up to 100,000 seats per event** (Celesta Moreira's concert scenario)
- ✅ **Handle up to 10,000 concurrent users**
- ✅ **At least 80% of tickets must be sellable within the first 4 hours**
- ✅ **Performance and reliability under peak load**

## Test Suites

### 1. Concurrent Seat Booking Tests (`tests/stress/stress-concurrent-booking.test.js`)

**Purpose**: Validates the system's ability to handle 10,000 concurrent users attempting seat booking.

**Key Scenarios**:

- 10,000 concurrent users attempting to book seats
- High contention scenarios with limited seats
- Gradual load increase (100 → 5,000 operations)
- Burst load test (3,000 operations simultaneously)

**Expected Results**:

- High conflict rate (50%+) due to seat contention
- Low error rate (<10%)
- Reasonable throughput (>100 ops/sec)
- Data consistency (reserved seats match successful operations)

### 2. Large Events Tests (`tests/stress/stress-large-events.test.js`)

**Purpose**: Tests creation and management of events with 100,000 seats.

**Key Scenarios**:

- Creating 100,000 seat events
- Pagination performance with large datasets
- 5,000 simultaneous users accessing large events
- Memory efficiency with multiple large events
- Seat selection performance across large seat ranges

**Expected Results**:

- Event creation within reasonable time
- Pagination response time <1 second average
- Memory usage <1GB for 100K seats
- Consistent performance across seat ranges

### 3. Payment Spike Tests (`tests/stress/stress-payment-spike.test.js`)

**Purpose**: Validates payment system performance under extreme concurrent load.

**Key Scenarios**:

- 5,000 simultaneous payment initiations
- 3,000 concurrent payment callbacks (success/failure)
- Payment timeout and rollback scenarios
- Mixed payment operations under extreme load

**Expected Results**:

- Payment throughput >200 ops/sec
- Success rate >90%
- Proper rollback handling
- Data consistency after failures

### 4. Ticket Sellability Tests (`tests/stress/stress-ticket-sellability.test.js`)

**Purpose**: Verifies the 80% ticket sellability requirement within 4 hours.

**Key Scenarios**:

- 4-hour compressed selling simulation
- Peak hour rush (5,000 concurrent users)
- Sustained load over extended periods
- Realistic selling patterns by hour

**Expected Results**:

- > 80% ticket sellability achieved
- System handles peak hour rushes
- Consistent performance over time
- High success rate during rush periods

### 5. Comprehensive System Tests (`tests/stress/stress-comprehensive.test.js`)

**Purpose**: End-to-end system stress testing with realistic user journeys.

**Key Scenarios**:

- Full system stress test with orchestrated scenarios
- 1,000 realistic user journeys (complete booking flow)
- 30-minute extended load simulation
- Error handling and recovery under stress

**Expected Results**:

- > 90% overall success rate
- Proper error handling for invalid requests
- System stability over extended periods
- Realistic user journey completion

## Running Tests

### Regular Tests (Unit & Integration)

```bash
# Run standard unit/integration tests (excludes stress tests)
npm test                    # Only integration tests
npm run test:integration    # Integration tests specifically
npm run test:watch         # Watch mode for integration tests
```

### Stress Tests (Separate Environment)

```bash
# Run complete stress test suite (30+ minutes)
npm run test:stress

# Show help and options
npm run test:stress -- --help

# Quick stress test (2 minutes)
npm run test:stress-quick
```

### Individual Stress Test Suites

```bash
# Individual stress test suites (use dedicated config)
npm run test:stress:concurrent     # Concurrent booking tests
npm run test:stress:large-events   # Large event tests
npm run test:stress:payment-spike  # Payment spike tests
npm run test:stress:sellability    # 80% sellability tests
npm run test:stress:comprehensive  # Comprehensive system tests
```

### Memory Configuration

For memory-intensive tests, increase Node.js memory limit:

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run test:stress
```

## Test Infrastructure

### Stress Test Helpers (`tests/stress/utils/stress-test-helpers.js`)

**Core Utilities**:

- `executeBatched()` - Batch execution with concurrency control
- `simulateConcurrentUsers()` - Concurrent user simulation
- `createLargeEvent()` - Large event creation for testing
- `measurePaginationPerformance()` - Pagination performance testing

**Performance Monitoring**:

- `PerformanceMonitor` - Real-time performance metrics collection
- `getMemoryUsage()` - Memory usage monitoring
- `generateLoadTestReport()` - Performance report generation

**Advanced Features**:

- `LoadTestOrchestrator` - Complex multi-scenario test orchestration
- `UserSimulator` - Realistic user journey simulation with think time
- Think time simulation for realistic user behavior

### Test Configuration

**Regular Tests** (`vitest.config.js`):

- Environment: Node.js
- Timeout: 30 seconds
- Include: `tests/integration/**`
- Exclude: `tests/stress/**`
- Coverage: Enabled for `src/**`

**Stress Tests** (`vitest.stress.config.js`):

- Environment: Node.js with increased resources
- Timeout: 10 minutes default (configurable up to 15 minutes)
- Include: `tests/stress/**/*.test.js`
- Pool: Single fork for better resource management
- Coverage: Disabled (performance-focused)
- Concurrency: 1 (serial execution)
- Reporter: Verbose output
- Bail: Stop on first failure

All stress tests include:

- Configurable timeouts (2-15 minutes)
- Performance requirements validation
- Memory usage monitoring
- Detailed reporting with metrics
- Pass/fail criteria based on PRD requirements

## Performance Baselines

### Response Time Requirements

- Seat browsing: <1 second average
- Booking creation: <2 seconds average
- Payment operations: <3 seconds average
- Large event operations: <5 seconds average

### Throughput Requirements

- Minimum throughput: 50-200 ops/sec (depending on operation)
- Peak hour handling: 5,000+ concurrent users
- Payment processing: 200+ payments/sec

### Error Rate Thresholds

- Standard operations: <5% error rate
- High-contention scenarios: <10% error rate
- Extended load: <15% error rate

### Memory Constraints

- 100K seat event: <1GB memory usage
- Peak memory: <2GB during stress tests
- Memory stability: No significant leaks over time

## Interpreting Results

### Success Indicators

- ✅ All test suites pass
- ✅ PRD compliance >75%
- ✅ Performance within baselines
- ✅ No critical errors or failures

### Warning Signs

- ⚠️ Some test failures but >50% success rate
- ⚠️ Performance degradation under load
- ⚠️ Memory usage approaching limits
- ⚠️ Error rates above thresholds

### Critical Issues

- ❌ Multiple test suite failures
- ❌ System instability under load
- ❌ Memory leaks or excessive usage
- ❌ PRD compliance <50%

## Troubleshooting

### Common Issues

1. **Memory Issues**

   ```bash
   # Increase Node.js memory limit
   export NODE_OPTIONS="--max-old-space-size=8192"
   ```

2. **Timeout Issues**

   ```bash
   # Run individual tests with custom timeout
   npx vitest tests/stress-concurrent-booking.test.js --testTimeout=300000
   ```

3. **Performance Issues**
   - Check system resources (CPU, memory)
   - Reduce concurrency levels in test configuration
   - Run tests on dedicated test environment

### CI/CD Considerations

For CI environments, consider:

- Reduced concurrency levels
- Shorter test durations
- Resource-aware test selection
- Parallel test execution limitations

## Best Practices

1. **Before Running Stress Tests**
   - Ensure adequate system resources
   - Close unnecessary applications
   - Use dedicated test environment for best results

2. **Monitoring During Tests**
   - Monitor system resources (CPU, memory, disk I/O)
   - Watch for memory leaks or performance degradation
   - Check test output for warnings or errors

3. **After Stress Tests**
   - Review detailed test reports
   - Analyze performance metrics
   - Compare results against PRD requirements
   - Document any performance regressions

## Production Readiness

The system is considered production-ready when:

- ✅ All stress tests pass consistently
- ✅ PRD requirements are met under load
- ✅ Performance baselines are achieved
- ✅ Error handling works correctly under stress
- ✅ Memory usage remains stable over time

This comprehensive stress testing suite ensures the Billetter API can handle real-world production loads according to all PRD specifications.
