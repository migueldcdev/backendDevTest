import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/adapters/inbound/http/server.ts';
import { GetSimilarProducts } from '../src/application/get-similar-products.ts';
import type { ProductCatalog } from '../src/application/ports.ts';
import { FakeProductCatalog, productWithId } from './fake-product-catalog.ts';

const requestSimilar = (catalog: ProductCatalog, productId: string) =>
  buildServer(new GetSimilarProducts(catalog)).inject({
    method: 'GET',
    url: `/product/${productId}/similar`,
  });

describe('GET /product/:productId/similar', () => {
  it('responds 200 with the similar product details', async () => {
    const catalog = new FakeProductCatalog({
      similarIds: { '1': ['2', '3'] },
      products: ['2', '3'].map(productWithId),
    });

    const response = await requestSimilar(catalog, '1');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(['2', '3'].map(productWithId));
  });

  it('responds 404 with a message when the product does not exist', async () => {
    const response = await requestSimilar(new FakeProductCatalog({}), '1');

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ message: 'Product 1 not found' });
  });

  it('responds 503 with a message when similar ids are unavailable', async () => {
    const response = await requestSimilar(new FakeProductCatalog({ unavailableIds: ['1'] }), '1');

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ message: 'Similar products are temporarily unavailable' });
  });

  it('responds 500 without leaking details on unexpected errors', async () => {
    const catalog: ProductCatalog = {
      getSimilarIds: async () => {
        throw new TypeError('secret detail');
      },
      getProduct: async () => null,
    };

    const response = await requestSimilar(catalog, '1');

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ message: 'Internal server error' });
  });
});
