# Billetter API

Ticket sales and reservation management API built with Fastify and Node.js.

## Setup

### Prerequisites

- Node.js 18+ with ESModule support
- npm or yarn

### Installation

```bash
npm install
```

## Development

### Start development server

```bash
npm run dev
```

The server will start on `http://localhost:3000` with auto-reload enabled.

### Code Quality

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Testing

#### Regular Tests (Unit & Integration)

```bash
# Run integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests specifically
npm run test:integration
```

#### Stress Tests (Performance & Load)

```bash
# Run comprehensive stress test suite (30+ minutes)
npm run test:stress

# Run quick stress test (2 minutes)
npm run test:stress-quick

# Run individual stress test suites
npm run test:stress:concurrent     # 10K concurrent users
npm run test:stress:large-events   # 100K seat events
npm run test:stress:payment-spike  # Payment system load
npm run test:stress:sellability    # 80% sellability in 4hrs
npm run test:stress:comprehensive  # Full system tests
```

**Note**: Stress tests are physically separated from regular tests and require significant system resources. They validate PRD requirements under extreme load conditions.

## Project Structure

```
src/
├── app.js              # Main application entry point
├── services/           # Business logic and data services
├── routes/             # API route handlers
└── __tests__/          # Test files
```

## API Endpoints

API documentation will be available once endpoints are implemented.

## Configuration

- ESModule imports/exports
- ESLint + Prettier for code quality
- Jest for testing
- TypeScript definitions in `types.d.ts`
