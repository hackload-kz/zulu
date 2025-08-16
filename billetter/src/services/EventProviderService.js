import EventProviderError from './EventProviderError.js';

/**
 * Service class for interacting with the EventProvider API
 */
class EventProviderService {
  /**
   * @param {import('../../types.d.ts').EventProviderConfig} config
   */
  constructor(config) {
    this.baseURL = config.baseURL;
  }

  /**
   * Makes an HTTP request to the EventProvider API
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {object} [body] - Request body
   * @returns {Promise<any>}
   * @private
   */
  async _makeRequest(endpoint, method, body = null) {
    const url = `${this.baseURL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        let responseBody;
        try {
          responseBody = await response.json();
        } catch {
          responseBody = await response.text();
        }
        throw new EventProviderError(
          `API request failed: ${response.status} ${response.statusText}`,
          response.status,
          responseBody
        );
      }

      // Handle responses with no content (204, etc.)
      if (
        response.status === 204 ||
        response.headers.get('content-length') === '0'
      ) {
        return undefined;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof EventProviderError) {
        throw error;
      }
      // Re-throw network errors as-is (per requirements)
      throw error;
    }
  }

  /**
   * Creates a new order
   * @returns {Promise<{order_id: string}>}
   */
  async startOrder() {
    return await this._makeRequest('/partners/v1/orders', 'POST');
  }

  /**
   * Retrieves order details by ID
   * @param {string} id - Order ID
   * @returns {Promise<import('../../types.d.ts').Order>}
   */
  async getOrder(id) {
    return await this._makeRequest(`/partners/v1/orders/${id}`, 'GET');
  }

  /**
   * Submits an order for processing
   * @param {string} id - Order ID
   * @returns {Promise<void>}
   */
  async submitOrder(id) {
    await this._makeRequest(`/partners/v1/orders/${id}/submit`, 'PATCH');
  }

  /**
   * Confirms a submitted order
   * @param {string} id - Order ID
   * @returns {Promise<void>}
   */
  async confirmOrder(id) {
    await this._makeRequest(`/partners/v1/orders/${id}/confirm`, 'PATCH');
  }

  /**
   * Cancels an order
   * @param {string} id - Order ID
   * @returns {Promise<void>}
   */
  async cancelOrder(id) {
    await this._makeRequest(`/partners/v1/orders/${id}/cancel`, 'PATCH');
  }

  /**
   * Retrieves a paginated list of places
   * @param {import('../../types.d.ts').PaginationParams} params - Pagination parameters
   * @returns {Promise<import('../../types.d.ts').Place[]>}
   */
  async listPlaces(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.pageSize)
      searchParams.set('pageSize', params.pageSize.toString());

    const query = searchParams.toString();
    const endpoint = query
      ? `/partners/v1/places?${query}`
      : '/partners/v1/places';

    return await this._makeRequest(endpoint, 'GET');
  }

  /**
   * Retrieves place details by ID
   * @param {string} id - Place ID
   * @returns {Promise<import('../../types.d.ts').Place>}
   */
  async getPlace(id) {
    return await this._makeRequest(`/partners/v1/places/${id}`, 'GET');
  }

  /**
   * Selects/reserves a place for an order
   * @param {string} placeId - Place ID
   * @param {string} orderId - Order ID
   * @returns {Promise<void>}
   */
  async selectPlace(placeId, orderId) {
    await this._makeRequest(`/partners/v1/places/${placeId}/select`, 'PATCH', {
      order_id: orderId,
    });
  }

  /**
   * Releases a previously selected place
   * @param {string} placeId - Place ID
   * @returns {Promise<void>}
   */
  async releasePlace(placeId) {
    await this._makeRequest(`/partners/v1/places/${placeId}/release`, 'PATCH');
  }
}

export default EventProviderService;
