/**
 * Custom error class for EventProvider API errors
 */
class EventProviderError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {any} responseBody - Response body from the API
   */
  constructor(message, statusCode, responseBody) {
    super(message);
    this.name = 'EventProviderError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export default EventProviderError;
