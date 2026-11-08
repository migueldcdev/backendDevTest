import { LRUCache } from 'lru-cache';
import type { ProductCatalog } from '../../application/ports.ts';
import type { ProductDetail } from '../../domain/product.ts';

export interface CacheSettings {
  readonly ttlMs: number;
  readonly maxEntries: number;
}

interface CacheEntry<T> {
  readonly value: T;
}

export class CachedProductCatalog implements ProductCatalog {
  private readonly similarIds: LRUCache<string, CacheEntry<string[]>>;
  private readonly products: LRUCache<string, CacheEntry<ProductDetail | null>>;

  constructor(
    private readonly inner: ProductCatalog,
    settings: CacheSettings,
  ) {
    const options = { ttl: settings.ttlMs, max: settings.maxEntries };
    this.similarIds = new LRUCache(options);
    this.products = new LRUCache(options);
  }

  getSimilarIds(productId: string): Promise<string[]> {
    return readThrough(this.similarIds, productId, () => this.inner.getSimilarIds(productId));
  }

  getProduct(productId: string): Promise<ProductDetail | null> {
    return readThrough(this.products, productId, () => this.inner.getProduct(productId));
  }
}

async function readThrough<T>(
  cache: LRUCache<string, CacheEntry<T>>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached.value;
  const value = await load();
  cache.set(key, { value });
  return value;
}
