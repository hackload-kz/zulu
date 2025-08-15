import Fastify from 'fastify';

const fastify = Fastify({
  logger: true,
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

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