import { buildServer } from './adapters/inbound/http/server.ts';
import { HttpProductCatalog } from './adapters/outbound/http-product-catalog.ts';
import { GetSimilarProducts } from './application/get-similar-products.ts';
import { config } from './config.ts';

const catalog = new HttpProductCatalog(config.upstream);
const server = buildServer(new GetSimilarProducts(catalog), { logger: true });
await server.listen({ port: config.port, host: '0.0.0.0' });
