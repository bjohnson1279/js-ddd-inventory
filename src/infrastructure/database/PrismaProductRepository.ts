import { IProductRepository } from "../../domain/repositories/IProductRepository";
import { Product } from "../../domain/product/aggregates/Product";
import { SKU } from "../../domain/valueObjects/SKU";
import { ProductVariant } from "../../domain/product/entities/ProductVariant";
import { VariantAttribute } from "../../domain/product/valueObjects/VariantAttribute";
import { VariantAttributeSet } from "../../domain/product/valueObjects/VariantAttributeSet";
import { prisma } from "./prisma";

export class PrismaProductRepository implements IProductRepository {
  private prisma = prisma;

  async findBySku(sku: SKU): Promise<Product | null> {
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

    if (!variantModel) {
      return null;
    }

    return this.hydrate(variantModel.product);
  }

  async findBySkus(skus: SKU[]): Promise<Product[]> {
    if (skus.length === 0) {
      return [];
    }

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
  }

  async save(product: Product): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.productModel.upsert({
        where: { id: product.id },
        update: { name: product.name },
        create: { id: product.id, name: product.name }
      });

      for (const variant of product.variants) {
        await tx.productVariantModel.upsert({
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
        });
      }
    });
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
