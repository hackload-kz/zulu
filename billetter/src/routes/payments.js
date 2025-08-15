async function paymentsRoutes(fastify, options) {
  const { billetterService } = options;

  const paymentCallbackSchema = {
    querystring: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: { type: 'integer' },
      },
    },
  };

  fastify.get(
    '/api/payments/success',
    { schema: paymentCallbackSchema },
    async (request, reply) => {
      try {
        const result = await billetterService.confirmPayment(
          request.query.orderId
        );
        reply.send(JSON.stringify(result));
      } catch (error) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  fastify.get(
    '/api/payments/fail',
    { schema: paymentCallbackSchema },
    async (request, reply) => {
      try {
        const result = await billetterService.failPayment(
          request.query.orderId
        );
        reply.send(JSON.stringify(result));
      } catch (error) {
        reply.code(500).send({ error: error.message });
      }
    }
  );
}

export default paymentsRoutes;
