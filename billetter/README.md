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

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

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