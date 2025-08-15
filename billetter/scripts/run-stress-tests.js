#!/usr/bin/env node

/**
 * Stress Test Runner for Billetter API
 *
 * This script runs comprehensive stress tests according to PRD requirements:
 * - Support up to 100,000 seats per event
 * - Handle up to 10,000 concurrent users
 * - At least 80% of tickets must be sellable within the first 4 hours
 * - Performance and reliability under peak load
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message) {
  log(`\n${'='.repeat(60)}`, colors.cyan);
  log(`${message}`, colors.bright + colors.cyan);
  log(`${'='.repeat(60)}`, colors.cyan);
}

function logStep(message) {
  log(`\n→ ${message}`, colors.blue);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

async function runVitest(testPattern, timeout = 600000) {
  return new Promise((resolve, reject) => {
    const args = [
      'run',
      '--config=vitest.stress.config.js',
      '--reporter=verbose',
      '--testTimeout=' + timeout,
      testPattern,
    ];

    log(`Running: npx vitest ${args.join(' ')}`, colors.dim);

    const child = spawn('npx', ['vitest', ...args], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        // Increase memory limit for stress tests
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function runStressTestSuite() {
  logHeader('BILLETTER API STRESS TEST SUITE');
  log('Testing PRD compliance under load conditions', colors.dim);

  const testSuites = [
    {
      name: 'Concurrent Seat Booking (10,000 Users)',
      pattern: 'tests/stress/stress-concurrent-booking.test.js',
      description:
        'Tests handling of 10,000 concurrent users attempting seat booking',
      timeout: 300000, // 5 minutes
    },
    {
      name: 'Large Events (100,000 Seats)',
      pattern: 'tests/stress/stress-large-events.test.js',
      description: 'Tests creation and management of 100,000 seat events',
      timeout: 600000, // 10 minutes
    },
    {
      name: 'Payment Spike Scenarios',
      pattern: 'tests/stress/stress-payment-spike.test.js',
      description: 'Tests payment system under heavy concurrent load',
      timeout: 300000, // 5 minutes
    },
    {
      name: '80% Ticket Sellability (4 Hours)',
      pattern: 'tests/stress/stress-ticket-sellability.test.js',
      description: 'Verifies 80% ticket sellability within 4-hour window',
      timeout: 600000, // 10 minutes
    },
    {
      name: 'Comprehensive System Tests',
      pattern: 'tests/stress/stress-comprehensive.test.js',
      description: 'Full system stress testing with realistic user journeys',
      timeout: 900000, // 15 minutes
    },
  ];

  const results = [];
  let totalTests = testSuites.length;
  let passedTests = 0;
  let failedTests = 0;

  logStep(`Running ${totalTests} stress test suites...`);

  for (const [index, suite] of testSuites.entries()) {
    logHeader(`TEST SUITE ${index + 1}/${totalTests}: ${suite.name}`);
    log(suite.description, colors.dim);

    const startTime = Date.now();

    try {
      await runVitest(suite.pattern, suite.timeout);
      const duration = Date.now() - startTime;

      logSuccess(`${suite.name} completed in ${Math.round(duration / 1000)}s`);
      results.push({ ...suite, status: 'PASSED', duration });
      passedTests++;
    } catch (error) {
      const duration = Date.now() - startTime;

      logError(`${suite.name} failed after ${Math.round(duration / 1000)}s`);
      logError(`Error: ${error.message}`);
      results.push({
        ...suite,
        status: 'FAILED',
        duration,
        error: error.message,
      });
      failedTests++;
    }
  }

  // Generate final report
  logHeader('STRESS TEST RESULTS SUMMARY');

  log(`Total Test Suites: ${totalTests}`);
  log(`Passed: ${passedTests}`, passedTests > 0 ? colors.green : colors.reset);
  log(`Failed: ${failedTests}`, failedTests > 0 ? colors.red : colors.reset);
  log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

  log('\nDetailed Results:', colors.bright);
  results.forEach((result, index) => {
    const statusColor = result.status === 'PASSED' ? colors.green : colors.red;
    const statusIcon = result.status === 'PASSED' ? '✅' : '❌';

    log(`\n${index + 1}. ${result.name}`);
    log(`   Status: ${statusIcon} ${result.status}`, statusColor);
    log(`   Duration: ${Math.round(result.duration / 1000)}s`);

    if (result.error) {
      log(`   Error: ${result.error}`, colors.red);
    }
  });

  // PRD Compliance Summary
  logHeader('PRD COMPLIANCE VERIFICATION');

  const requirements = [
    {
      requirement: 'Support up to 100,000 seats per event',
      test: 'Large Events (100,000 Seats)',
      status:
        results.find((r) => r.name.includes('Large Events'))?.status ||
        'NOT_RUN',
    },
    {
      requirement: 'Handle up to 10,000 concurrent users',
      test: 'Concurrent Seat Booking (10,000 Users)',
      status:
        results.find((r) => r.name.includes('Concurrent Seat Booking'))
          ?.status || 'NOT_RUN',
    },
    {
      requirement: '80% tickets sellable within 4 hours',
      test: '80% Ticket Sellability (4 Hours)',
      status:
        results.find((r) => r.name.includes('80% Ticket Sellability'))
          ?.status || 'NOT_RUN',
    },
    {
      requirement: 'Performance under peak load',
      test: 'Payment Spike Scenarios + Comprehensive Tests',
      status:
        results.find(
          (r) =>
            r.name.includes('Payment Spike') || r.name.includes('Comprehensive')
        )?.status || 'NOT_RUN',
    },
  ];

  requirements.forEach((req, index) => {
    const statusColor =
      req.status === 'PASSED'
        ? colors.green
        : req.status === 'FAILED'
          ? colors.red
          : colors.yellow;
    const statusIcon =
      req.status === 'PASSED' ? '✅' : req.status === 'FAILED' ? '❌' : '⚠️';

    log(`\n${index + 1}. ${req.requirement}`);
    log(`   Test: ${req.test}`);
    log(`   Status: ${statusIcon} ${req.status}`, statusColor);
  });

  const complianceRate =
    (requirements.filter((r) => r.status === 'PASSED').length /
      requirements.length) *
    100;

  log(
    `\nOverall PRD Compliance: ${Math.round(complianceRate)}%`,
    complianceRate >= 75
      ? colors.green
      : complianceRate >= 50
        ? colors.yellow
        : colors.red
  );

  // Final verdict
  if (failedTests === 0) {
    logSuccess(
      '\n🎉 All stress tests passed! System is ready for production load.'
    );
  } else if (failedTests <= totalTests / 2) {
    logWarning(
      '\n⚠️  Some stress tests failed. Review failed tests before production deployment.'
    );
  } else {
    logError(
      '\n🚨 Multiple stress tests failed. System may not handle production load adequately.'
    );
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

// Command line argument parsing
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  logHeader('BILLETTER STRESS TEST RUNNER');
  console.log(`
Usage: npm run stress-test [options]

Options:
  --help, -h     Show this help message
  --quick        Run quick stress tests only (shorter duration)
  --full         Run full stress test suite (default)

Environment Variables:
  NODE_OPTIONS   Set to '--max-old-space-size=4096' for memory-intensive tests

Examples:
  npm run stress-test           # Run full stress test suite
  npm run stress-test -- --quick   # Run quick stress tests only

Test Suites:
  1. Concurrent Seat Booking    - 10,000 concurrent users
  2. Large Events             - 100,000 seat event management  
  3. Payment Spike            - High-load payment processing
  4. Ticket Sellability       - 80% sellability in 4 hours
  5. Comprehensive System     - End-to-end stress testing

Note: Stress tests require significant system resources and may take 30+ minutes to complete.
`);
  process.exit(0);
}

// Check if running in CI/test environment
if (process.env.CI) {
  log(
    'Detected CI environment - adjusting test parameters for CI constraints',
    colors.yellow
  );
}

// Start stress tests
runStressTestSuite().catch((error) => {
  logError(`Stress test runner failed: ${error.message}`);
  process.exit(1);
});
