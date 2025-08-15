async function eventsRoutes(fastify, options) {
  const { billetterService } = options;

  const createEventSchema = {
    body: {
      type: 'object',
      required: ['title', 'external'],
      properties: {
        title: { type: 'string' },
        external: { type: 'boolean' },
      },
    },
  };

  fastify.post(
    '/api/events',
    { schema: createEventSchema },
    async (request, reply) => {
      try {
        const result = await billetterService.createEvent(request.body);
        reply.code(201).send(result);
      } catch (error) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  fastify.get('/api/events', async (request, reply) => {
    try {
      const events = await billetterService.getEvents();
      reply.send(events);
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
}

export default eventsRoutes;
