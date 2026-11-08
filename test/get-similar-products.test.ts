import { describe, expect, it } from 'vitest';
import { GetSimilarProducts } from '../src/application/get-similar-products.ts';
import { FakeProductCatalog, productWithId } from './fake-product-catalog.ts';

describe('GetSimilarProducts', () => {
  it('returns details in similarity order even when they resolve out of order', async () => {
    const catalog = new FakeProductCatalog({
      similarIds: { '1': ['2', '3', '4'] },
      products: ['2', '3', '4'].map(productWithId),
      delaysMs: { '2': 30, '3': 15 },
    });

    const similar = await new GetSimilarProducts(catalog).execute('1');

    expect(similar).toEqual(['2', '3', '4'].map(productWithId));
  });
});
