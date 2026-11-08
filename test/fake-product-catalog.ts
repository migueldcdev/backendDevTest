import { setTimeout as sleep } from 'node:timers/promises';
import type { ProductCatalog } from '../src/application/ports.ts';
import { ProductNotFoundError } from '../src/domain/errors.ts';
import type { ProductDetail } from '../src/domain/product.ts';

interface CatalogScenario {
  similarIds?: Record<string, string[]>;
  products?: ProductDetail[];
  delaysMs?: Record<string, number>;
}

export class FakeProductCatalog implements ProductCatalog {
  constructor(private readonly scenario: CatalogScenario) {}

  async getSimilarIds(productId: string): Promise<string[]> {
    const ids = this.scenario.similarIds?.[productId];
    if (!ids) throw new ProductNotFoundError(productId);
    return ids;
  }

  async getProduct(productId: string): Promise<ProductDetail | null> {
    await sleep(this.scenario.delaysMs?.[productId] ?? 0);
    return this.scenario.products?.find((product) => product.id === productId) ?? null;
  }
}

export const productWithId = (id: string): ProductDetail => ({
  id,
  name: `Product ${id}`,
  price: Number(id),
  availability: true,
});
