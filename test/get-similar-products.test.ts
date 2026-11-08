import { describe, expect, it } from 'vitest';
import { GetSimilarProducts } from '../src/application/get-similar-products.ts';
import { ProductNotFoundError, UpstreamUnavailableError } from '../src/domain/errors.ts';
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

  it('returns each similar product once when upstream repeats ids', async () => {
    const catalog = new FakeProductCatalog({
      similarIds: { '1': ['2', '3', '2'] },
      products: ['2', '3'].map(productWithId),
    });

    const similar = await new GetSimilarProducts(catalog).execute('1');

    expect(similar).toEqual(['2', '3'].map(productWithId));
  });

  it('returns an empty list when the product has no similar ids', async () => {
    const catalog = new FakeProductCatalog({ similarIds: { '1': [] } });

    await expect(new GetSimilarProducts(catalog).execute('1')).resolves.toEqual([]);
  });

  it('omits similar products that are not found or unavailable', async () => {
    const catalog = new FakeProductCatalog({
      similarIds: { '1': ['2', '5', '6', '3'] },
      products: ['2', '3'].map(productWithId),
      unavailableIds: ['6'],
    });

    const similar = await new GetSimilarProducts(catalog).execute('1');

    expect(similar).toEqual(['2', '3'].map(productWithId));
  });

  it('returns an empty list when every similar product is unavailable', async () => {
    const catalog = new FakeProductCatalog({
      similarIds: { '1': ['2', '3'] },
      unavailableIds: ['2', '3'],
    });

    await expect(new GetSimilarProducts(catalog).execute('1')).resolves.toEqual([]);
  });

  it('fails with not found when the product does not exist', async () => {
    const catalog = new FakeProductCatalog({});

    await expect(new GetSimilarProducts(catalog).execute('1')).rejects.toThrow(ProductNotFoundError);
  });

  it('fails with unavailable when similar ids cannot be fetched', async () => {
    const catalog = new FakeProductCatalog({ unavailableIds: ['1'] });

    await expect(new GetSimilarProducts(catalog).execute('1')).rejects.toThrow(UpstreamUnavailableError);
  });

  it('propagates unexpected errors instead of omitting the product', async () => {
    const bug = new TypeError('bug');
    const catalog = {
      getSimilarIds: async () => ['2'],
      getProduct: async () => {
        throw bug;
      },
    };

    await expect(new GetSimilarProducts(catalog).execute('1')).rejects.toBe(bug);
  });
});
