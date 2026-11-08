import type { ProductDetail } from '../domain/product.ts';

export interface ProductCatalog {
  getSimilarIds(productId: string): Promise<string[]>;
  getProduct(productId: string): Promise<ProductDetail | null>;
}
