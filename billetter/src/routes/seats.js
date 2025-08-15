async function seatsRoutes(fastify, options) {
  const { billetterService } = options;

  const seatsQuerySchema = {
    querystring: {
      type: 'object',
      required: ['event_id'],
      properties: {
        event_id: { type: 'integer' },
        page: { type: 'integer', minimum: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 20 },
      },
    },
  };

  const selectSeatSchema = {
    body: {
      type: 'object',
      required: ['booking_id', 'seat_id'],
      properties: {
        booking_id: { type: 'integer' },
        seat_id: { type: 'integer' },
      },
    },
  };

  const releaseSeatSchema = {
    body: {
      type: 'object',
      required: ['seat_id'],
      properties: {
        seat_id: { type: 'integer' },
      },
    },
  };

  fastify.get(
    '/api/seats',
    { schema: seatsQuerySchema },
    async (request, reply) => {
      try {
        const seats = await billetterService.getSeats(request.query);
        reply.send(seats);
      } catch (error) {
        if (error.message === 'Event not found') {
          reply.code(404).send({ error: error.message });
        } else if (error.message === 'Invalid pagination parameters') {
          reply.code(400).send({ error: error.message });
        } else {
          reply.code(500).send({ error: error.message });
        }
      }
    }
  );

  fastify.patch(
    '/api/seats/select',
    { schema: selectSeatSchema },
    async (request, reply) => {
      try {
        const result = await billetterService.selectSeat(request.body);
        reply.send(JSON.stringify(result));
      } catch (error) {
        if (error.message === 'Failed to add seat to booking') {
          reply.code(419).send(JSON.stringify(error.message));
        } else if (
          error.message === 'Booking not found' ||
          error.message === 'Seat not found'
        ) {
          reply.code(404).send({ error: error.message });
        } else {
          reply.code(400).send({ error: error.message });
        }
      }
    }
  );

  fastify.patch(
    '/api/seats/release',
    { schema: releaseSeatSchema },
    async (request, reply) => {
      try {
        const result = await billetterService.releaseSeat(request.body);
        reply.send(JSON.stringify(result));
      } catch (error) {
        if (error.message === 'Failed to release seat') {
          reply.code(419).send(JSON.stringify(error.message));
        } else if (error.message === 'Seat not found') {
          reply.code(404).send({ error: error.message });
        } else {
          reply.code(500).send({ error: error.message });
        }
      }
    }
  );
}

export default seatsRoutes;
