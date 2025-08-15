# Product Requirements Document (PRD): Billetter API

## 1. Purpose

Develop an API for ticket sales and reservation management, strictly compliant with the given OpenAPI (https://hub.hackload.kz/docs/Biletter-api.json) specification, using Node.js. The API must be fully covered by automated tests that simulate real-world and edge-case scenarios as described below.

---

## 2. Key Features/Entities

### 2.1 Events
- **Fields:**
  - `id` (unique event identifier)
  - `title` (event name)
  - `external` (event type: internal/external, boolean)

### 2.2 Bookings
- **Fields:**
  - `id` (unique booking identifier)
  - `event_id` (linked event)
  - `status` (booked → seats selected → payment initiated → confirmed/cancelled)

### 2.3 Seats
- **Fields:**
  - `id` (unique seat identifier)
  - `row` (row number)
  - `number` (seat number in row)
  - `reserved` (reservation status: true/false)

---

## 3. API Endpoints & Requirements

### 3.1 Events
- **POST `/api/events`** - Create new event
  - Request: `{ "title": "string", "external": false }`
  - Response: `201 Created`, `{ "id": number }`

- **GET `/api/events`** - Get all events
  - Response: `200 OK`, `[ { "id": number, "title": "string" } ]`

---

### 3.2 Bookings
- **POST `/api/bookings`** - Create booking for an event
  - Request: `{ "event_id": number }`
  - Response: `201 Created`, `{ "id": number }`

- **GET `/api/bookings`** - Get all bookings for current user
  - Response: `200 OK`, `[ { "id": number, "event_id": number } ]`

- **PATCH `/api/bookings/initiatePayment`** - Move booking to awaiting payment (locks chosen seats)
  - Request: `{ "booking_id": number }`
  - Response: `200 OK`, `"Booking is awaiting payment confirmation"`

- **PATCH `/api/bookings/cancel`** - Cancel booking (frees all seats)
  - Request: `{ "booking_id": number }`
  - Response: `200 OK`, `"Booking successfully cancelled"`

---

### 3.3 Seats
- **GET `/api/seats?event_id=&page=&pageSize=`** - List seats for event (required: `event_id`; optional: pagination)
  - Response: `200 OK`, `[ { "id": number, "row": number, "number": number, "reserved": bool } ]`
  - Pagination: `page` (min 1), `pageSize` (1-20)

- **PATCH `/api/seats/select`** - Select seat for booking (seat becomes unavailable to others)
  - Request: `{ "booking_id": number, "seat_id": number }`
  - Response: `200 OK`, `"Seat successfully added to booking"`
  - Conflict: `419`, `"Failed to add seat to booking"`

- **PATCH `/api/seats/release`** - Release seat from booking (seat becomes available)
  - Request: `{ "seat_id": number }`
  - Response: `200 OK` `"Seat successfully released"`
  - Conflict: `419`, `"Failed to release seat"`

---

### 3.4 Payments
- **GET `/api/payments/success?orderId=booking_id`**  
   Callback for successful payment. Confirms booking.
   - Response: `200 OK`, `"OK"`

- **GET `/api/payments/fail?orderId=booking_id`**  
   Callback for unsuccessful payment. Cancels booking, releases seats.
   - Response: `200 OK`, `"OK"`

---

## 4. Technical / Implementation Requirements

### 4.1 Framework & Language
- **Fastify** HTTP REST API framework for high performance and built-in validation
- **JavaScript** with **TypeScript support** for type definitions only via `types.d.ts` file in project root
- **ESLint + Prettier** with default configurations for code quality and formatting

### 4.2 Data Layer Architecture
- **BilletterService** abstract class providing interface for all API endpoint methods
- **InMemoryBilletterService** implementation using Node.js application memory (arrays, maps, etc.)
- No external database required for current implementation

### 4.3 Testing Framework
- **Jest** for comprehensive automated testing
- All test scenarios from section 5 must be implemented

### 4.4 API Compliance
- **Full compliance:**  
  - Endpoint routes, request/response bodies, parameters, and HTTP status codes must strictly match the specification.
  - All query/body parameters must be validated, missing or malformed parameters must return `400 Bad Request`.
  - Use correct codes:  
    - `404 Not Found`
    - `400 Bad Request`
    - `419 Conflict` (seat reservation conflict)
    - `500 Internal Server Error`
- **Pagination** is mandatory for all seat listings.
- **Atomicity** for seat selection/release.
- **Reservation Timeouts** must be implemented to prevent seat blocking.
- **Idempotency** for payment operations.
- **Booking lifecycle** states must be enforced as per scenario (creation, selection, payment, confirmation, cancellation).

### 4.5 Performance/Load
- Support up to 100,000 seats per event (e.g. Celesta Moreira's concert).
- Handle up to 10,000 concurrent users.
- At least 80% of tickets must be sellable within the first 4 hours.

### 4.6 Future Security Considerations
- Note for future implementation: Helmet for HTTP headers security, Fastify plugins for rate limiting and enhanced input validation
- Spam and abuse protection in seat reservation and booking endpoints (to be implemented in future updates)

---

## 5. Testing Requirements

### 5.1 Test Scenarios (Automate all below)
1. **Full successful booking flow**
   - Create event → Create booking → Select seats → Initiate payment → Success notification → Booking confirmed

2. **Cancel booking at various stages**
   - Before seat selection, after seat selection, after payment initiation but before confirmation

3. **Concurrent seat booking**
   - Two or more clients simultaneously attempt to book the same seat; only one must succeed, others get `419 Conflict`.

4. **Unsuccessful payments and rollbacks**
   - Fail payment after seat reserved, ensure seats are released and booking is cancelled.

5. **Pagination in large seat lists**
   - Validate correct page size, boundaries, content order for 100,000+ seats.

### 5.2 Load Testing
- Simulate heavy realistic loads:
  - 100,000 seat event, 10,000 simultaneous users, spike in bookings and payments.
  - Ensure performance and data consistency.

---

## 6. Critical Notes

- Performance and reliability must be proven under peak load.
- Error handling, idempotency, and atomicity are strictly required.

---

## 7. Deliverables

1. **Fastify API** (JavaScript with TypeScript definitions) implementing all endpoints above.
2. **BilletterService abstract class** and **InMemoryBilletterService** implementation.
3. **Comprehensive automated tests** using Jest for all scenarios (to be implemented before core business logic).
4. **ESLint + Prettier** configuration and code quality setup.
5. **Documentation** (README, run/test instructions).

---

## 8. References

- [Billetter OpenAPI Specification (JSON)](https://hub.hackload.kz/docs/Biletter-api.json)

