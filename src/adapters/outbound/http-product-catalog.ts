import type { ProductCatalog } from '../../application/ports.ts';
import { ProductNotFoundError, UpstreamUnavailableError } from '../../domain/errors.ts';
import type { ProductDetail } from '../../domain/product.ts';

export interface UpstreamSettings {
  readonly baseUrl: string;
  readonly timeoutMs: number;
}

export class HttpProductCatalog implements ProductCatalog {
  constructor(private readonly upstream: UpstreamSettings) {}

  async getSimilarIds(productId: string): Promise<string[]> {
    const body = await this.fetchJsonOrNull(`/product/${encodeURIComponent(productId)}/similarids`);
    if (body === null) throw new ProductNotFoundError(productId);
    return toSimilarIds(body);
  }

  async getProduct(productId: string): Promise<ProductDetail | null> {
    const body = await this.fetchJsonOrNull(`/product/${encodeURIComponent(productId)}`);
    return body === null ? null : toProductDetail(body);
  }

  private async fetchJsonOrNull(path: string): Promise<unknown> {
    try {
      const response = await fetch(`${this.upstream.baseUrl}${path}`, {
        signal: AbortSignal.timeout(this.upstream.timeoutMs),
      });
      if (response.status === 404) {
        await response.body?.cancel();
        return null;
      }
      if (!response.ok) throw new Error(`Responded with status ${response.status}`);
      return await response.json();
    } catch (error) {
      throw new UpstreamUnavailableError(`GET ${path} failed`, { cause: error });
    }
  }
}

function toSimilarIds(body: unknown): string[] {
  if (!Array.isArray(body)) throw new UpstreamUnavailableError('Similar ids are not a list');
  const ids: unknown[] = body;
  if (!ids.every((id) => typeof id === 'string' || typeof id === 'number')) {
    throw new UpstreamUnavailableError('Similar ids contain invalid values');
  }
  return ids.map(String);
}

function toProductDetail(body: unknown): ProductDetail {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body && typeof body.id === 'string' && body.id !== '') ||
    !('name' in body && typeof body.name === 'string' && body.name !== '') ||
    !('price' in body && typeof body.price === 'number') ||
    !('availability' in body && typeof body.availability === 'boolean')
  ) {
    throw new UpstreamUnavailableError('Product detail is malformed');
  }
  return { id: body.id, name: body.name, price: body.price, availability: body.availability };
}
