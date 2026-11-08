import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { GetSimilarProducts } from '../../../application/get-similar-products.ts';
import { ProductNotFoundError, UpstreamUnavailableError } from '../../../domain/errors.ts';

export function buildServer(
  getSimilarProducts: GetSimilarProducts,
  options: FastifyServerOptions = {},
): FastifyInstance {
  const server = Fastify(options);

  server.get<{ Params: { productId: string } }>('/product/:productId/similar', (request) =>
    getSimilarProducts.execute(request.params.productId),
  );

  server.setErrorHandler((error, request, reply) => {
    if (error instanceof ProductNotFoundError) {
      return reply.code(404).send({ message: error.message });
    }
    if (error instanceof UpstreamUnavailableError) {
      return reply.code(503).send({ message: 'Similar products are temporarily unavailable' });
    }
    request.log.error(error);
    return reply.code(500).send({ message: 'Internal server error' });
  });

  return server;
}
