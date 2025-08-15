import Fastify from 'fastify';
import { InMemoryBilletterService } from './services/InMemoryBilletterService.js';
import eventsRoutes from './routes/events.js';
import bookingsRoutes from './routes/bookings.js';
import seatsRoutes from './routes/seats.js';
import paymentsRoutes from './routes/payments.js';

const fastify = Fastify({
  logger: false,
});

const billetterService = new InMemoryBilletterService();

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
fastify.register(eventsRoutes, { billetterService });
fastify.register(bookingsRoutes, { billetterService });
fastify.register(seatsRoutes, { billetterService });
fastify.register(paymentsRoutes, { billetterService });

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`Server running on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// For testing purposes
export { fastify };

// Start server if this file is run directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  start();
}
