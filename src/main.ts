import { buildServer } from './adapters/inbound/http/server.ts';
import { GetSimilarProducts } from './application/get-similar-products.ts';
import type { ProductCatalog } from './application/ports.ts';
import { config } from './config.ts';
import { ProductNotFoundError } from './domain/errors.ts';

const unwiredCatalog: ProductCatalog = {
  getSimilarIds: async (productId) => {
    throw new ProductNotFoundError(productId);
  },
  getProduct: async () => null,
};

const server = buildServer(new GetSimilarProducts(unwiredCatalog), { logger: true });
await server.listen({ port: config.port, host: '0.0.0.0' });
