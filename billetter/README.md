# Billetter API

Enterprise-grade ticket sales and reservation management API built with Fastify and Node.js. Fully compliant with the [Hackload Ticketing Service OpenAPI specification](https://hub.hackload.kz/docs/Biletter-api.json).

## Features

### Core Functionality
- **Event Management**: Create and manage internal/external events
- **Seat Reservation**: Real-time seat selection with conflict resolution
- **Booking Lifecycle**: Complete booking flow from creation to confirmation
- **Payment Integration**: Success/failure callback handling with automatic rollback
- **Pagination**: Efficient handling of large seat inventories (100K+ seats)

### Performance & Scale
- Supports events with up to **100,000 seats**
- Handles up to **10,000 concurrent users**  
- **80% ticket sellability** within first 4 hours
- Atomic seat operations with reservation timeouts
- Enterprise-grade load testing suite

### API Compliance
- Full OpenAPI specification compliance
- Comprehensive error handling (400, 404, 419, 500)
- Request/response validation
- Idempotent payment operations

## Architecture

### Service Layer
- **EventProviderService**: External API wrapper for Hackload Ticketing Service
- **BilletterService**: Abstract service interface  
- **InMemoryBilletterService**: High-performance in-memory implementation

### Data Models
- **Events**: Internal/external event management
- **Bookings**: Multi-stage booking lifecycle (booked → seats selected → payment → confirmed/cancelled)
- **Seats**: Row/number identification with reservation status
- **Orders & Places**: External provider integration models

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
# Run all tests
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

**Note**: Stress tests validate PRD requirements under extreme load conditions and require significant system resources.

## API Endpoints

### Events
- `POST /api/events` - Create new event
- `GET /api/events` - List all events

### Bookings  
- `POST /api/bookings` - Create booking for event
- `GET /api/bookings` - Get user bookings
- `PATCH /api/bookings/initiatePayment` - Lock seats, await payment
- `PATCH /api/bookings/cancel` - Cancel booking, release seats

### Seats
- `GET /api/seats` - List seats with pagination (required: `event_id`)
- `PATCH /api/seats/select` - Select seat for booking
- `PATCH /api/seats/release` - Release seat from booking

### Payments
- `GET /api/payments/success` - Payment success callback
- `GET /api/payments/fail` - Payment failure callback with rollback

## Project Structure

```
src/
├── app.js                          # Fastify application entry point
├── services/
│   ├── EventProviderService.js     # External API wrapper
│   ├── EventProviderError.js       # API error handling
│   └── InMemoryBilletterService.js # Core business logic
└── routes/
    ├── events.js                   # Event management endpoints
    ├── bookings.js                 # Booking lifecycle endpoints
    ├── seats.js                    # Seat reservation endpoints
    └── payments.js                 # Payment callback endpoints

tests/
├── integration/                    # API endpoint tests
├── stress/                         # Performance & load tests
└── unit/                          # Service layer tests
```

## Configuration

- **Framework**: Fastify for high performance and built-in validation
- **Language**: JavaScript with TypeScript definitions in `types.d.ts`
- **Code Quality**: ESLint + Prettier with default configurations
- **Testing**: Vitest for unit/integration, comprehensive stress testing
- **Architecture**: ESModule imports/exports, service-based design
