import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, it, vi } from 'vitest';
import { CachedProductCatalog } from '../src/adapters/outbound/cached-product-catalog.ts';
import { UpstreamUnavailableError } from '../src/domain/errors.ts';
import { FakeProductCatalog, productWithId } from './fake-product-catalog.ts';

const cachedCatalogOver = (inner: FakeProductCatalog, { ttlMs = 60_000, maxEntries = 10 } = {}) =>
  new CachedProductCatalog(inner, { ttlMs, maxEntries });

describe('CachedProductCatalog', () => {
  it('serves a repeated product from cache', async () => {
    const inner = new FakeProductCatalog({ products: [productWithId('2')] });
    const getProduct = vi.spyOn(inner, 'getProduct');
    const catalog = cachedCatalogOver(inner);

    await catalog.getProduct('2');
    await expect(catalog.getProduct('2')).resolves.toEqual(productWithId('2'));

    expect(getProduct).toHaveBeenCalledTimes(1);
  });

  it('serves repeated similar ids from cache', async () => {
    const inner = new FakeProductCatalog({ similarIds: { '1': ['2', '3'] } });
    const getSimilarIds = vi.spyOn(inner, 'getSimilarIds');
    const catalog = cachedCatalogOver(inner);

    await catalog.getSimilarIds('1');
    await expect(catalog.getSimilarIds('1')).resolves.toEqual(['2', '3']);

    expect(getSimilarIds).toHaveBeenCalledTimes(1);
  });

  it('reloads a product once its entry expires', async () => {
    const inner = new FakeProductCatalog({ products: [productWithId('2')] });
    const getProduct = vi.spyOn(inner, 'getProduct');
    const catalog = cachedCatalogOver(inner, { ttlMs: 20 });

    await catalog.getProduct('2');
    await sleep(40);
    await catalog.getProduct('2');

    expect(getProduct).toHaveBeenCalledTimes(2);
  });

  it('caches a product that was not found', async () => {
    const inner = new FakeProductCatalog({});
    const getProduct = vi.spyOn(inner, 'getProduct');
    const catalog = cachedCatalogOver(inner);

    await catalog.getProduct('5');
    await expect(catalog.getProduct('5')).resolves.toBeNull();

    expect(getProduct).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures', async () => {
    const inner = new FakeProductCatalog({ unavailableIds: ['6'] });
    const getProduct = vi.spyOn(inner, 'getProduct');
    const catalog = cachedCatalogOver(inner);

    await expect(catalog.getProduct('6')).rejects.toThrow(UpstreamUnavailableError);
    await expect(catalog.getProduct('6')).rejects.toThrow(UpstreamUnavailableError);

    expect(getProduct).toHaveBeenCalledTimes(2);
  });

  it('shares one upstream call between concurrent requests for the same product', async () => {
    const inner = new FakeProductCatalog({ products: [productWithId('2')], delaysMs: { '2': 20 } });
    const getProduct = vi.spyOn(inner, 'getProduct');
    const catalog = cachedCatalogOver(inner);

    const results = await Promise.all([1, 2, 3].map(() => catalog.getProduct('2')));

    expect(results).toEqual([1, 2, 3].map(() => productWithId('2')));
    expect(getProduct).toHaveBeenCalledTimes(1);
  });

  it('retries after a shared concurrent call fails', async () => {
    const inner = new FakeProductCatalog({ unavailableIds: ['6'], delaysMs: { '6': 20 } });
    const getProduct = vi.spyOn(inner, 'getProduct');
    const catalog = cachedCatalogOver(inner);

    const results = await Promise.allSettled([1, 2].map(() => catalog.getProduct('6')));
    await catalog.getProduct('6').catch(() => null);

    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
    expect(getProduct).toHaveBeenCalledTimes(2);
  });

  it('evicts the least recently used product when full', async () => {
    const inner = new FakeProductCatalog({ products: ['2', '3', '4'].map(productWithId) });
    const getProduct = vi.spyOn(inner, 'getProduct');
    const catalog = cachedCatalogOver(inner, { maxEntries: 2 });

    for (const id of ['2', '3', '4', '2']) await catalog.getProduct(id);

    expect(getProduct).toHaveBeenCalledTimes(4);
  });
});
