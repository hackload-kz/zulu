# Stress Tests

This directory contains comprehensive stress tests for the Billetter API, designed to validate PRD compliance under extreme load conditions.

## ⚠️ Important Notes

- **Resource Intensive**: These tests require significant CPU, memory, and time
- **Separated from Regular Tests**: Stress tests are excluded from `npm test`
- **Production Validation**: Tests validate system readiness for production load

## Quick Start

```bash
# Run all stress tests (30+ minutes, requires 4GB+ RAM)
npm run test:stress

# Run quick test (2 minutes)
npm run test:stress-quick
```

## Test Suites

| Test Suite         | File                                | Duration | Purpose                     |
| ------------------ | ----------------------------------- | -------- | --------------------------- |
| Concurrent Booking | `stress-concurrent-booking.test.js` | 5 min    | 10K concurrent users        |
| Large Events       | `stress-large-events.test.js`       | 10 min   | 100K seat management        |
| Payment Spikes     | `stress-payment-spike.test.js`      | 5 min    | Payment system load         |
| Ticket Sellability | `stress-ticket-sellability.test.js` | 10 min   | 80% sellability requirement |
| Comprehensive      | `stress-comprehensive.test.js`      | 15 min   | Full system validation      |

## PRD Requirements Tested

- ✅ **100,000 seats per event** - Large Events tests
- ✅ **10,000 concurrent users** - Concurrent Booking tests
- ✅ **80% ticket sellability in 4 hours** - Sellability tests
- ✅ **Performance under peak load** - All test suites

## System Requirements

- **Memory**: 4GB+ available RAM
- **CPU**: Multi-core processor recommended
- **Time**: Allow 30+ minutes for full suite
- **Environment**: Dedicated test environment preferred

## Configuration

Stress tests use a dedicated configuration (`vitest.stress.config.js`) with:

- Extended timeouts (10+ minutes)
- Single process execution for resource management
- Memory optimization settings
- Verbose reporting

See [STRESS_TESTING.md](../../STRESS_TESTING.md) for detailed documentation.
