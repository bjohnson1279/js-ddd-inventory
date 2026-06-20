import { IProductRepository } from "../../domain/repositories/IProductRepository";
import { Product } from "../../domain/product/aggregates/Product";
import { SKU } from "../../domain/valueObjects/SKU";

export class InMemoryProductRepository implements IProductRepository {
  private readonly products: Map<string, Product> = new Map();

  async findBySku(sku: SKU): Promise<Product | null> {
    for (const product of this.products.values()) {
      for (const variant of product.variants) {
        if (variant.sku.equals(sku)) {
          return product;
        }
      }
    }
    return null;
  }

  async findBySkus(skus: SKU[]): Promise<Product[]> {
    const results: Product[] = [];
    for (const sku of skus) {
      const product = await this.findBySku(sku);
      if (product && !results.some(r => r.id === product.id)) {
        results.push(product);
      }
    }
    return results;
  }

  async save(product: Product): Promise<void> {
    this.products.set(product.id, product);
  }
}
