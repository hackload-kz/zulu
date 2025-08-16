## Product Requirements Document: Hackload Ticketing Service

### 1. Overview

This document specifies the requirements for a Node.js wrapper for the Hackload Ticketing Service Provider API. This wrapper will be implemented as a class and serve as the primary interface for interacting with the ticketing service from within our existing Node.js application.

The primary goal is to abstract the complexity of the underlying HTTP REST API, providing a simple, robust, and well-tested module for managing ticket orders and place reservations.

### 2. Goals and Objectives

- **Abstraction:** Encapsulate all HTTP requests, request/response bodies, and endpoint logic into a clean, intuitive class-based interface.
- **Reliability:** Implement comprehensive error handling to manage API-specific errors, network issues, and invalid state transitions gracefully.
- **Testability:** Ensure the wrapper is fully unit-tested, with all external API calls stubbed. This allows for reliable testing of our application's business logic without depending on the live API.

### 3. Functional Requirements

The API wrapper will be implemented as a class named `EventProviderService`.

#### 3.1. Configuration and Instantiation

The class constructor must accept a configuration object to set a mandatory base URL for the API and any optional authentication credentials.

**Example:**

```typescript
const apiClient = new EventProviderService({
  baseURL: 'http://localhost:8080/api',
});
```

#### 3.2. Data Models (Types)

The wrapper will expose interfaces for the API's data structures.

- **`Order`**
  ```typescript
  interface Order {
    id: string;
    status: 'STARTED' | 'SUBMITTED' | 'CONFIRMED' | 'CANCELLED';
    started_at: number; // Unix timestamp in milliseconds
    updated_at: number; // Unix timestamp in milliseconds
    places_count: number;
  }
  ```
- **`Place`**
  ```typescript
  interface Place {
    id: string;
    row: number;
    seat: number;
    is_free: boolean;
  }
  ```
- **`PaginationParams`**
  ```typescript
  interface PaginationParams {
    page?: number;
    pageSize?: number;
  }
  ```

#### 3.3. Class Methods

The `EventProviderService` class will expose the following public methods, corresponding to the partner API endpoints.

##### 3.3.1. Order Management

- **`startOrder(): Promise<{ order_id: string }>`**
  - **Description:** Creates a new order.
  - **Endpoint:** `POST /partners/v1/orders`
  - **Success Response:** Returns an object containing the new `order_id`.

- **`getOrder(id: string): Promise<Order>`**
  - **Description:** Retrieves the details of a specific order by its ID.
  - **Endpoint:** `GET /partners/v1/orders/{id}`
  - **Success Response:** Returns the full `Order` object.

- **`submitOrder(id: string): Promise<void>`**
  - **Description:** Submits an order for processing. Moves the order from `STARTED` to `SUBMITTED`.
  - **Endpoint:** `PATCH /partners/v1/orders/{id}/submit`
  - **Success Response:** Resolves with no value (`void`).

- **`confirmOrder(id: string): Promise<void>`**
  - **Description:** Confirms a submitted order. Moves the order to the terminal `CONFIRMED` status.
  - **Endpoint:** `PATCH /partners/v1/orders/{id}/confirm`
  - **Success Response:** Resolves with no value (`void`).

- **`cancelOrder(id: string): Promise<void>`**
  - **Description:** Cancels an order. Moves the order to the terminal `CANCELLED` status.
  - **Endpoint:** `PATCH /partners/v1/orders/{id}/cancel`
  - **Success Response:** Resolves with no value (`void`).

##### 3.3.2. Place Management

- **`listPlaces(params: PaginationParams): Promise<Place[]>`**
  - **Description:** Retrieves a paginated list of available places.
  - **Endpoint:** `GET /partners/v1/places`
  - **Parameters:** `page` (default 1), `pageSize` (default 20).
  - **Success Response:** Returns an array of `Place` objects.

- **`getPlace(id: string): Promise<Place>`**
  - **Description:** Retrieves the details of a single place by its ID.
  - **Endpoint:** `GET /partners/v1/places/{id}`
  - **Success Response:** Returns a `Place` object.

- **`selectPlace(placeId: string, orderId: string): Promise<void>`**
  - **Description:** Selects/reserves a place for a specific order.
  - **Endpoint:** `PATCH /partners/v1/places/{id}/select`
  - **Request Body:** `{ "order_id": orderId }`
  - **Success Response:** Resolves with no value (`void`).

- **`releasePlace(placeId: string): Promise<void>`**
  - **Description:** Releases a previously selected place. This is only valid for orders in the `STARTED` state.
  - **Endpoint:** `PATCH /partners/v1/places/{id}/release`
  - **Success Response:** Resolves with no value (`void`).

#### 3.4. Error Handling

The wrapper must provide a robust error-handling mechanism.

1.  **General API Error:** A generic `EventProviderError` class should be created to wrap all errors originating from the API. It should contain the original status code, error message, and any response body from the server.
2.  **Network Errors:** Standard network errors (e.g., timeouts, DNS issues) should not be caught.

### 4. Non-Functional Requirements

- **Performance:** The wrapper should use an efficient, modern HTTP client library (e.g. `fetch`) to minimize latency. It should not introduce any significant performance overhead.
- **Dependencies:** The module should have minimal external dependencies to avoid bloating the main application.

### 5. Technical Requirements

- **Language:** JavaScript (with TypeScript for typing).
- **Mocking:** All HTTP requests to the external API **must be stubbed** during testing.
- **Test Coverage:** The test suite should cover:
  - All public methods.
  - Successful API interactions (2xx status codes).
  - API error responses (4xx, 5xx status codes).
  - Specific business logic errors.
  - Network failures.
  - Correct handling of request parameters and bodies.

### 6. Out of Scope

- **Admin API Endpoints:** This wrapper will only implement the "Partner" endpoints. The `/api/admin/v1/places` endpoint is out of scope for this task.
- **Auto-Retry Logic:** An automatic retry mechanism for transient errors (e.g., 503 Service Unavailable, 429 Too Many Requests) is not required for the initial version but can be considered for future evolution.
- **Local Caching:** The wrapper will not implement any caching layer. All calls will be forwarded directly to the API.
