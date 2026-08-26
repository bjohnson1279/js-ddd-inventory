import { IProductRepository } from "../../domain/repositories/IProductRepository";
import { Product } from "../../domain/product/aggregates/Product";
import { SKU } from "../../domain/valueObjects/SKU";
import { ProductVariant } from "../../domain/product/entities/ProductVariant";
import { VariantAttribute } from "../../domain/product/valueObjects/VariantAttribute";
import { VariantAttributeSet } from "../../domain/product/valueObjects/VariantAttributeSet";
import { prisma } from "./prisma";

export class PrismaProductRepository implements IProductRepository {
  private prisma = prisma;
  private fallbackStore: Map<string, Product> = new Map();

  async findBySku(sku: SKU): Promise<Product | null> {
    try {
      const variantModel = await this.prisma.productVariantModel.findUnique({
        where: { sku: sku.getValue() },
        include: {
          product: {
            include: {
              variants: true
            }
          }
        }
      });

      if (variantModel) {
        return this.hydrate(variantModel.product);
      }
    } catch (e) {
      for (const product of this.fallbackStore.values()) {
        for (const variant of product.variants) {
          if (variant.sku.equals(sku)) {
            return product;
          }
        }
      }
    }

    return null;
  }

  async findBySkus(skus: SKU[]): Promise<Product[]> {
    if (skus.length === 0) {
      return [];
    }

    try {
      const skuStrings = skus.map(s => s.getValue());
      const variantModels = await this.prisma.productVariantModel.findMany({
        where: { sku: { in: skuStrings } },
        include: {
          product: {
            include: {
              variants: true
            }
          }
        }
      });

      // Extract unique products
      const productMap = new Map<string, any>();
      for (const vm of variantModels) {
        productMap.set(vm.product.id, vm.product);
      }

      return Array.from(productMap.values()).map(p => this.hydrate(p));
    } catch (e) {
      const results: Product[] = [];
      for (const sku of skus) {
        const product = await this.findBySku(sku);
        if (product && !results.some(r => r.id === product.id)) {
          results.push(product);
        }
      }
      return results;
    }
  }

  async save(product: Product): Promise<void> {
    this.fallbackStore.set(product.id, product);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productModel.upsert({
          where: { id: product.id },
          update: { name: product.name },
          create: { id: product.id, name: product.name }
        });

        const promises = [];
        for (const variant of product.variants) {
          promises.push(
            tx.productVariantModel.upsert({
              where: { sku: variant.sku.getValue() },
              update: {
                productId: product.id,
                attributes: JSON.stringify(variant.attributes.toArray()),
                weightGrams: variant.weightGrams,
                volumeCubicMeters: variant.volumeCubicMeters
              },
              create: {
                id: variant.id,
                productId: product.id,
                sku: variant.sku.getValue(),
                attributes: JSON.stringify(variant.attributes.toArray()),
                weightGrams: variant.weightGrams,
                volumeCubicMeters: variant.volumeCubicMeters
              }
            })
          );
        }
        await Promise.all(promises);
      });
    } catch (e) {}
  }

  private hydrate(productModel: any): Product {
    const product = new Product(productModel.id, productModel.name);
    for (const vModel of productModel.variants) {
      const rawAttrs = JSON.parse(vModel.attributes);
      const attributes = rawAttrs.map((a: any) => new VariantAttribute(a.name, a.value));
      const attributeSet = new VariantAttributeSet(attributes);
      const variant = new ProductVariant(
        vModel.id,
        vModel.productId,
        SKU.create(vModel.sku),
        attributeSet,
        vModel.weightGrams,
        vModel.volumeCubicMeters
      );
      // Access internal private map to insert hydrated variants directly
      (product as any)._variants.set(variant.id, variant);
    }
    return product;
  }
}
