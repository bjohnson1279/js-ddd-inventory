const productStore = new Map<string, any>();
const variantStore = new Map<string, any>();

jest.mock("../../../src/infrastructure/database/prisma", () => {
  const mockTx = {
    productModel: {
      upsert: jest.fn(async (args: any) => {
        const id = args.where.id;
        const data = { id, ...(args.update || {}), ...(args.create || {}) };
        productStore.set(id, { ...(productStore.get(id) || {}), ...data });
        return productStore.get(id);
      }),
    },
    productVariantModel: {
      upsert: jest.fn(async (args: any) => {
        const sku = args.where.sku;
        const data = { ...(args.update || {}), ...(args.create || {}) };
        const existingId = Array.from(variantStore.entries()).find(([_, v]) => v.sku === sku)?.[0] || data.id;
        const updated = { id: existingId, ...data };
        variantStore.set(existingId, updated);
        return updated;
      }),
    },
  };

  return {
    prisma: {
      productModel: {
        findUnique: jest.fn(async (args: any) => {
          return productStore.get(args.where.id) || null;
        }),
      },
      productVariantModel: {
        findUnique: jest.fn(async (args: any) => {
          const sku = args.where.sku;
          const found = Array.from(variantStore.values()).find((v) => v.sku === sku);
          if (!found) return null;

          const product = productStore.get(found.productId);
          const variants = Array.from(variantStore.values()).filter(
            (v) => v.productId === found.productId
          );

          return {
            ...found,
            product: product
              ? {
                  ...product,
                  variants: variants.map((v) => ({ ...v })),
                }
              : null,
          };
        }),
        findMany: jest.fn(async (args: any) => {
          const skuList = args.where?.sku?.in || [];
          const matchedVariants = Array.from(variantStore.values()).filter((v) =>
            skuList.includes(v.sku)
          );

          return matchedVariants.map((vm) => {
            const product = productStore.get(vm.productId);
            const variants = Array.from(variantStore.values()).filter(
              (v) => v.productId === vm.productId
            );
            return {
              ...vm,
              product: product
                ? {
                    ...product,
                    variants: variants.map((v) => ({ ...v })),
                  }
                : null,
            };
          });
        }),
      },
      $transaction: jest.fn(async (callback: any) => {
        return callback(mockTx);
      }),
      $disconnect: jest.fn(),
    },
    pool: {
      end: jest.fn(),
    },
  };
});

import { PrismaProductRepository } from "../../../src/infrastructure/database/PrismaProductRepository";
import { prisma as mockPrisma } from "../../../src/infrastructure/database/prisma";
import { Product } from "../../../src/domain/product/aggregates/Product";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { VariantAttribute } from "../../../src/domain/product/valueObjects/VariantAttribute";

describe("PrismaProductRepository Unit Tests", () => {
  let repo: PrismaProductRepository;

  beforeEach(() => {
    productStore.clear();
    variantStore.clear();
    jest.clearAllMocks();
    repo = new PrismaProductRepository();
  });

  describe("save", () => {
    it("should persist a product and its variants into prisma and the fallback store", async () => {
      const product = new Product("PROD-1", "Cotton T-Shirt");
      product.addVariant(
        SKU.create("TSHIRT-RED-S"),
        [new VariantAttribute("color", "red"), new VariantAttribute("size", "S")],
        150,
        0.001
      );
      product.addVariant(
        SKU.create("TSHIRT-BLU-M"),
        [new VariantAttribute("color", "blue"), new VariantAttribute("size", "M")],
        160,
        0.0012
      );

      await repo.save(product);

      expect(productStore.has("PROD-1")).toBe(true);
      expect(productStore.get("PROD-1")?.name).toBe("Cotton T-Shirt");
      expect(variantStore.size).toBe(2);

      const variants = Array.from(variantStore.values());
      const redVariant = variants.find((v) => v.sku === "TSHIRT-RED-S");
      expect(redVariant).toBeDefined();
      expect(redVariant?.productId).toBe("PROD-1");
      expect(redVariant?.weightGrams).toBe(150);
      expect(redVariant?.volumeCubicMeters).toBe(0.001);
      expect(JSON.parse(redVariant?.attributes)).toEqual([
        { name: "color", value: "red" },
        { name: "size", value: "S" },
      ]);
    });

    it("should gracefully catch errors during prisma transaction without throwing", async () => {
      jest.spyOn(mockPrisma, "$transaction").mockRejectedValueOnce(new Error("DB Connection Error"));

      const product = new Product("PROD-ERR", "Error Product");
      product.addVariant(SKU.create("ERR-SKU"), [new VariantAttribute("color", "black")]);

      await expect(repo.save(product)).resolves.not.toThrow();

      // Product was not saved to prisma, but was saved to fallbackStore.
      // If findUnique fails, it falls back to fallbackStore.
      jest.spyOn(mockPrisma.productVariantModel, "findUnique").mockRejectedValueOnce(new Error("DB error"));
      const fallbackFound = await repo.findBySku(SKU.create("ERR-SKU"));
      expect(fallbackFound).not.toBeNull();
      expect(fallbackFound?.id).toBe("PROD-ERR");
    });
  });

  describe("findBySku", () => {
    it("should return null when variant does not exist", async () => {
      const result = await repo.findBySku(SKU.create("NON-EXISTENT"));
      expect(result).toBeNull();
    });

    it("should retrieve and hydrate product by SKU from prisma", async () => {
      const product = new Product("PROD-100", "Hydrated Product");
      product.addVariant(
        SKU.create("HYD-SKU-1"),
        [new VariantAttribute("material", "cotton"), new VariantAttribute("fit", "regular")],
        200,
        0.002
      );
      await repo.save(product);

      const found = await repo.findBySku(SKU.create("HYD-SKU-1"));
      expect(found).not.toBeNull();
      expect(found?.id).toBe("PROD-100");
      expect(found?.name).toBe("Hydrated Product");
      expect(found?.variants.length).toBe(1);

      const variant = found?.findVariantBySku("HYD-SKU-1");
      expect(variant).toBeDefined();
      expect(variant?.sku.getValue()).toBe("HYD-SKU-1");
      expect(variant?.weightGrams).toBe(200);
      expect(variant?.volumeCubicMeters).toBe(0.002);
      expect(variant?.attributes.all()).toEqual([
        new VariantAttribute("fit", "regular"),
        new VariantAttribute("material", "cotton"),
      ]);
    });

    it("should fallback to fallbackStore if prisma throws an error", async () => {
      const product = new Product("PROD-FALLBACK", "Fallback Product");
      product.addVariant(SKU.create("FALLBACK-SKU"), [new VariantAttribute("test", "true")]);

      await repo.save(product);

      // Simulate prisma database failure
      jest
        .spyOn(mockPrisma.productVariantModel, "findUnique")
        .mockRejectedValueOnce(new Error("Database offline"));

      const found = await repo.findBySku(SKU.create("FALLBACK-SKU"));
      expect(found).not.toBeNull();
      expect(found?.id).toBe("PROD-FALLBACK");
      expect(found?.name).toBe("Fallback Product");
    });

    it("should return null if prisma throws an error and variant is not in fallbackStore", async () => {
      jest
        .spyOn(mockPrisma.productVariantModel, "findUnique")
        .mockRejectedValueOnce(new Error("Database offline"));

      const found = await repo.findBySku(SKU.create("UNKNOWN-FALLBACK"));
      expect(found).toBeNull();
    });
  });

  describe("findBySkus", () => {
    it("should return an empty array when given an empty list of SKUs", async () => {
      const results = await repo.findBySkus([]);
      expect(results).toEqual([]);
    });

    it("should retrieve multiple unique products by their SKUs from prisma", async () => {
      const p1 = new Product("PROD-A", "Product A");
      p1.addVariant(SKU.create("SKU-A1"), [new VariantAttribute("opt", "1")]);
      p1.addVariant(SKU.create("SKU-A2"), [new VariantAttribute("opt", "2")]);

      const p2 = new Product("PROD-B", "Product B");
      p2.addVariant(SKU.create("SKU-B1"), [new VariantAttribute("opt", "1")]);

      await repo.save(p1);
      await repo.save(p2);

      // Querying SKU-A1 and SKU-A2 should return product A once
      const resultsForA = await repo.findBySkus([SKU.create("SKU-A1"), SKU.create("SKU-A2")]);
      expect(resultsForA.length).toBe(1);
      expect(resultsForA[0].id).toBe("PROD-A");
      expect(resultsForA[0].variants.length).toBe(2);

      // Querying SKU-A1 and SKU-B1 should return both products
      const resultsBoth = await repo.findBySkus([SKU.create("SKU-A1"), SKU.create("SKU-B1")]);
      expect(resultsBoth.length).toBe(2);
      const ids = resultsBoth.map((p) => p.id).sort();
      expect(ids).toEqual(["PROD-A", "PROD-B"]);
    });

    it("should fallback to calling findBySku per SKU when prisma findMany throws an error", async () => {
      const p1 = new Product("PROD-FB1", "Product FB1");
      p1.addVariant(SKU.create("FB-SKU-1"), [new VariantAttribute("opt", "1")]);
      p1.addVariant(SKU.create("FB-SKU-2"), [new VariantAttribute("opt", "2")]);

      await repo.save(p1);

      // Simulate findMany failure, but findUnique also fails so it hits fallbackStore
      jest
        .spyOn(mockPrisma.productVariantModel, "findMany")
        .mockRejectedValueOnce(new Error("findMany crashed"));
      jest
        .spyOn(mockPrisma.productVariantModel, "findUnique")
        .mockRejectedValue(new Error("findUnique crashed"));

      const results = await repo.findBySkus([SKU.create("FB-SKU-1"), SKU.create("FB-SKU-2")]);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("PROD-FB1");
    });
  });
});
