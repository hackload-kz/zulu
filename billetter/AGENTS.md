# Agent Development Guide

## Commands

- **Test**: `npm test` (integration tests), `vitest run tests/integration/booking-flow.test.js` (single test file)
- **Lint**: `npm run lint`, `npm run lint:fix` (auto-fix)
- **Format**: `npm run format`, `npm run format:check` (check only)
- **Start**: `npm start` (production), `npm run dev` (development with watch)
- **Stress Tests**: `npm run test:stress` (all), `npm run test:stress:concurrent` (specific)

## Code Style

- **Language**: JavaScript ES6+ modules with JSDoc types and global TypeScript definitions
- **Formatting**: Prettier (2 spaces, single quotes, semicolons, trailing commas ES5)
- **Imports**: Use destructuring, group by: Node.js built-ins, npm packages, local modules
- **Naming**: camelCase for variables/functions, PascalCase for classes, UPPER_CASE for constants
- **Error Handling**: Use proper HTTP status codes, return structured error objects with message/code
- **Types**: Use JSDoc comments and global types from `types.d.ts`

## Architecture

- **API**: Fastify REST API with route handlers in `src/routes/`
- **Services**: Business logic in `src/services/` (BilletterService interface pattern)
- **Testing**: Vitest with integration/unit/stress tests, group related tests in describe blocks
- **Data**: In-memory implementation (InMemoryBilletterService) for development/testing

## Key Patterns

- Service interface pattern for data layer abstraction
- Async/await for all asynchronous operations
- Fastify plugin registration for routes with service injection
- RESTful API design with proper HTTP methods and status codes
