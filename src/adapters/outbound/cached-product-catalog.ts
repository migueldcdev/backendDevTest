import { LRUCache } from 'lru-cache';
import type { ProductCatalog } from '../../application/ports.ts';
import type { ProductDetail } from '../../domain/product.ts';

export interface CacheSettings {
  readonly ttlMs: number;
  readonly maxEntries: number;
}

export class CachedProductCatalog implements ProductCatalog {
  private readonly similarIds: LRUCache<string, Promise<string[]>>;
  private readonly products: LRUCache<string, Promise<ProductDetail | null>>;

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

function readThrough<T>(
  cache: LRUCache<string, Promise<T>>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = load();
  cache.set(key, pending);
  pending.catch(() => {
    if (cache.peek(key) === pending) cache.delete(key);
  });
  return pending;
}
