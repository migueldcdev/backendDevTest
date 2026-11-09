import { LRUCache } from 'lru-cache';
import type { ProductCatalog } from '../../application/ports.ts';
import type { ProductDetail } from '../../domain/product.ts';

export interface CacheSettings {
  readonly ttlMs: number;
  readonly maxEntries: number;
  readonly failureTtlMs: number;
}

export class CachedProductCatalog implements ProductCatalog {
  private readonly similarIds: LRUCache<string, Promise<string[]>>;
  private readonly products: LRUCache<string, Promise<ProductDetail | null>>;

  constructor(
    private readonly inner: ProductCatalog,
    private readonly settings: CacheSettings,
  ) {
    const options = { ttl: settings.ttlMs, max: settings.maxEntries };
    this.similarIds = new LRUCache(options);
    this.products = new LRUCache(options);
  }

  getSimilarIds(productId: string): Promise<string[]> {
    return this.readThrough(this.similarIds, productId, () => this.inner.getSimilarIds(productId));
  }

  getProduct(productId: string): Promise<ProductDetail | null> {
    return this.readThrough(this.products, productId, () => this.inner.getProduct(productId));
  }

  private readThrough<T>(cache: LRUCache<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
    const cached = cache.get(key);
    if (cached) return cached;
    const pending = load();
    cache.set(key, pending);
    pending.catch(() => {
      if (cache.peek(key) === pending) cache.set(key, pending, { ttl: this.settings.failureTtlMs });
    });
    return pending;
  }
}
