import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpProductCatalog } from '../src/adapters/outbound/http-product-catalog.ts';
import { ProductNotFoundError, UpstreamUnavailableError } from '../src/domain/errors.ts';

interface StubResponse {
  status?: number;
  body?: unknown;
  delayMs?: number;
}

const routes: Record<string, StubResponse> = {
  '/product/1/similarids': { body: [2, '3'] },
  '/product/2': { body: { id: '2', name: 'Dress', price: 19.99, availability: true, extra: 'x' } },
  '/product/a%2Fb': { body: { id: 'a/b', name: 'Slash', price: 1, availability: false } },
  '/product/6': { status: 500, body: { message: 'boom' } },
  '/product/7': { delayMs: 200, body: { id: '7', name: 'Slow', price: 1, availability: true } },
  '/product/8': { body: { id: '8', name: 'Broken' } },
  '/product/9/similarids': { body: { not: 'a list' } },
};

let upstream: Server;
let catalog: HttpProductCatalog;

beforeAll(async () => {
  upstream = createServer((request, response) => {
    const route = routes[request.url ?? ''] ?? { status: 404, body: { message: 'not found' } };
    setTimeout(() => {
      response.writeHead(route.status ?? 200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(route.body));
    }, route.delayMs ?? 0);
  });
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const address = upstream.address();
  if (address === null || typeof address === 'string') throw new Error('Upstream stub has no port');
  catalog = new HttpProductCatalog({ baseUrl: `http://127.0.0.1:${address.port}`, timeoutMs: 100 });
});

afterAll(() => {
  upstream.closeAllConnections();
  upstream.close();
});

describe('HttpProductCatalog', () => {
  it('maps similar ids to strings', async () => {
    await expect(catalog.getSimilarIds('1')).resolves.toEqual(['2', '3']);
  });

  it('maps a product detail keeping only contract fields', async () => {
    await expect(catalog.getProduct('2')).resolves.toEqual({
      id: '2',
      name: 'Dress',
      price: 19.99,
      availability: true,
    });
  });

  it('encodes the product id into a single path segment', async () => {
    await expect(catalog.getProduct('a/b')).resolves.toMatchObject({ id: 'a/b' });
  });

  it('fails with not found when similar ids respond 404', async () => {
    await expect(catalog.getSimilarIds('404')).rejects.toThrow(ProductNotFoundError);
  });

  it('resolves null when a product responds 404', async () => {
    await expect(catalog.getProduct('404')).resolves.toBeNull();
  });

  it('fails with unavailable when upstream responds 5xx', async () => {
    await expect(catalog.getProduct('6')).rejects.toThrow(UpstreamUnavailableError);
  });

  it('fails with unavailable when upstream exceeds the timeout', async () => {
    await expect(catalog.getProduct('7')).rejects.toThrow(UpstreamUnavailableError);
  });

  it('fails with unavailable when a product detail is malformed', async () => {
    await expect(catalog.getProduct('8')).rejects.toThrow(UpstreamUnavailableError);
  });

  it('fails with unavailable when similar ids are not a list', async () => {
    await expect(catalog.getSimilarIds('9')).rejects.toThrow(UpstreamUnavailableError);
  });

  it('fails with unavailable when upstream is unreachable', async () => {
    const unreachable = new HttpProductCatalog({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 100 });

    await expect(unreachable.getProduct('2')).rejects.toThrow(UpstreamUnavailableError);
  });
});
