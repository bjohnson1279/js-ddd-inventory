import { AuditProcessorService } from "./src/domain/services/AuditProcessorService";
import { prisma } from "./src/infrastructure/database/prisma";

async function run() {
  await prisma.productVariantModel.deleteMany({});
  await prisma.inventoryModel.deleteMany({});
  await prisma.productModel.deleteMany({});
  await prisma.tenantModel.deleteMany({});

  await prisma.tenantModel.create({
    data: {
      id: "tenant-1",
      name: "tenant 1"
    }
  });

  // Insert 50 variants
  for (let i = 0; i < 50; i++) {
    await prisma.productModel.create({
      data: {
        id: `prod-${i}`,
        name: `Product ${i}`
      }
    });

    await prisma.productVariantModel.create({
      data: {
        id: `var-${i}`,
        productId: `prod-${i}`,
        sku: `SKU-${i}`,
        attributes: "[]"
      }
    });
    await prisma.inventoryModel.create({
      data: {
        id: `inv-${i}`,
        sku: `SKU-${i}`,
        locationId: `loc-1`,
        quantity: 5
      }
    });
  }

  process.env.SHOPIFY_SHOP_URL = "example.myshopify.com";
  process.env.SHOPIFY_ACCESS_TOKEN = "real-token-to-trigger-fetch";

  // mock fetch
  const originalFetch = global.fetch;
  global.fetch = async (...args) => {
    // add small artificial delay to simulate network
    await new Promise(r => setTimeout(r, 10));
    return {
      ok: true,
      json: async () => ({
        data: {
          inventoryItems: {
            edges: [
              {
                node: {
                  id: "1",
                  inventoryLevels: {
                    edges: [
                      {
                        node: {
                          location: { id: "gid://shopify/Location/67890" },
                          quantities: [{ quantity: 5 }]
                        }
                      }
                    ]
                  }
                }
              }
            ]
          }
        }
      })
    } as any;
  };

  const service = new AuditProcessorService();
  const start = Date.now();
  await service.runAudit("tenant-1");
  const end = Date.now();

  console.log(`AuditProcessorService.runAudit took ${end - start} ms for 50 items`);
  global.fetch = originalFetch;
}

run().catch(console.error).finally(() => prisma.$disconnect());
