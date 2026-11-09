import { buildServer } from './adapters/inbound/http/server.ts';
import { CachedProductCatalog } from './adapters/outbound/cached-product-catalog.ts';
import { HttpProductCatalog } from './adapters/outbound/http-product-catalog.ts';
import { GetSimilarProducts } from './application/get-similar-products.ts';
import { config } from './config.ts';

const catalog = new CachedProductCatalog(new HttpProductCatalog(config.upstream), config.cache);
const server = buildServer(new GetSimilarProducts(catalog), { logger: true });
await server.listen({ port: config.port, host: '0.0.0.0' });

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => void server.close());
}
