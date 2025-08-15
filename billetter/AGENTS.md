# Agent Development Guide

## Commands

- **Test**: `npm test` (all tests), `npm test -- booking-flow` (single test file)
- **Lint**: `npm run lint`
- **Start**: `npm start` (production), `npm run dev` (development)

## Code Style

- **Language**: JavaScript (ES6+) with JSDoc types and global TypeScript definitions
- **Formatting**: Prettier (2 spaces, single quotes, no semicolons, trailing commas)
- **Imports**: Use destructuring, group by: Node.js built-ins, npm packages, local modules
- **Naming**: camelCase for variables/functions, PascalCase for classes, UPPER_CASE for constants
- **Error Handling**: Use proper HTTP status codes, return structured error objects with message/code
- **Types**: Use JSDoc comments and global types from `types.d.ts`

## Architecture

- **API**: Express.js REST API with route handlers in `src/routes/`
- **Services**: Business logic in `src/services/` (BilletterService interface pattern)
- **Testing**: Vitest with supertest for API testing, group related tests in describe blocks
- **Data**: In-memory implementation (InMemoryBilletterService) for development/testing

## Key Patterns

- Service interface pattern for data layer abstraction
- Async/await for all asynchronous operations
- Middleware for common functionality (error handling, validation)
- RESTful API design with proper HTTP methods and status codes
