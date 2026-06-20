import { SKU } from "../valueObjects/SKU";
import { Product } from "../product/aggregates/Product";

export interface IProductRepository {
  findBySku(sku: SKU): Promise<Product | null>;
  findBySkus(skus: SKU[]): Promise<Product[]>;
  save(product: Product): Promise<void>;
}
