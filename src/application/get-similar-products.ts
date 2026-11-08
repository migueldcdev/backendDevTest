import type { ProductDetail } from '../domain/product.ts';
import type { ProductCatalog } from './ports.ts';

export class GetSimilarProducts {
  constructor(private readonly catalog: ProductCatalog) {}

  async execute(productId: string): Promise<ProductDetail[]> {
    const ids = await this.catalog.getSimilarIds(productId);
    const details = await Promise.all(ids.map((id) => this.catalog.getProduct(id)));
    return details.filter((detail) => detail !== null);
  }
}
