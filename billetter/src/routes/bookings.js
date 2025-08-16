async function bookingsRoutes(fastify, options) {
  const { billetterService } = options;

  const createBookingSchema = {
    body: {
      type: 'object',
      required: ['event_id'],
      properties: {
        event_id: { type: 'integer' },
      },
    },
  };

  const initiatePaymentSchema = {
    body: {
      type: 'object',
      required: ['booking_id'],
      properties: {
        booking_id: { type: 'integer' },
      },
    },
  };

  const cancelBookingSchema = {
    body: {
      type: 'object',
      required: ['booking_id'],
      properties: {
        booking_id: { type: 'integer' },
      },
    },
  };

  fastify.post(
    '/api/bookings',
    { schema: createBookingSchema },
    async (request, reply) => {
      try {
        const result = await billetterService.createBooking(request.body);
        reply.code(201).send(result);
      } catch (error) {
        if (error.message === 'Event not found') {
          reply.code(404).send({ error: error.message });
        } else {
          reply.code(500).send({ error: error.message });
        }
      }
    }
  );

  fastify.get('/api/bookings', async (request, reply) => {
    try {
      const bookings = await billetterService.getBookings();
      reply.send(bookings);
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  fastify.patch(
    '/api/bookings/initiatePayment',
    { schema: initiatePaymentSchema },
    async (request, reply) => {
      try {
        const paymentUrl = await billetterService.initiatePayment(request.body);
        reply.code(302).header('Location', paymentUrl).send();
      } catch (error) {
        if (error.message === 'Booking not found') {
          reply.code(404).send({ error: error.message });
        } else {
          reply.code(400).send({ error: error.message });
        }
      }
    }
  );

  fastify.patch(
    '/api/bookings/cancel',
    { schema: cancelBookingSchema },
    async (request, reply) => {
      try {
        const result = await billetterService.cancelBooking(request.body);
        reply.send(JSON.stringify(result));
      } catch (error) {
        if (error.message === 'Booking not found') {
          reply.code(404).send({ error: error.message });
        } else {
          reply.code(500).send({ error: error.message });
        }
      }
    }
  );
}

export default bookingsRoutes;
