import { setTimeout as sleep } from 'node:timers/promises';
import type { ProductCatalog } from '../src/application/ports.ts';
import { ProductNotFoundError, UpstreamUnavailableError } from '../src/domain/errors.ts';
import type { ProductDetail } from '../src/domain/product.ts';

interface CatalogScenario {
  similarIds?: Record<string, string[]>;
  products?: ProductDetail[];
  delaysMs?: Record<string, number>;
  unavailableIds?: string[];
}

export class FakeProductCatalog implements ProductCatalog {
  constructor(private readonly scenario: CatalogScenario) {}

  async getSimilarIds(productId: string): Promise<string[]> {
    this.failIfUnavailable(productId);
    const ids = this.scenario.similarIds?.[productId];
    if (!ids) throw new ProductNotFoundError(productId);
    return ids;
  }

  async getProduct(productId: string): Promise<ProductDetail | null> {
    await sleep(this.scenario.delaysMs?.[productId] ?? 0);
    this.failIfUnavailable(productId);
    return this.scenario.products?.find((product) => product.id === productId) ?? null;
  }

  private failIfUnavailable(productId: string): void {
    if (this.scenario.unavailableIds?.includes(productId)) {
      throw new UpstreamUnavailableError(`Product ${productId} unavailable`);
    }
  }
}

export const productWithId = (id: string): ProductDetail => ({
  id,
  name: `Product ${id}`,
  price: Number(id),
  availability: true,
});
