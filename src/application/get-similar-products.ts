import { UpstreamUnavailableError } from '../domain/errors.ts';
import type { ProductDetail } from '../domain/product.ts';
import type { ProductCatalog } from './ports.ts';

export class GetSimilarProducts {
  constructor(private readonly catalog: ProductCatalog) {}

  async execute(productId: string): Promise<ProductDetail[]> {
    const ids = new Set(await this.catalog.getSimilarIds(productId));
    const details = await Promise.all([...ids].map((id) => this.getProductIfAvailable(id)));
    return details.filter((detail) => detail !== null);
  }

  private async getProductIfAvailable(productId: string): Promise<ProductDetail | null> {
    try {
      return await this.catalog.getProduct(productId);
    } catch (error) {
      if (error instanceof UpstreamUnavailableError) return null;
      throw error;
    }
  }
}
