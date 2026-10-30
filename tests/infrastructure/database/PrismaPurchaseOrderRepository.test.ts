const poStore = new Map<string, any>();
const itemStore = new Map<string, any>();

jest.mock("../../../src/infrastructure/database/prisma", () => {
  const mockTx = {
    purchaseOrderModel: {
      upsert: jest.fn(async (args: any) => {
        const id = args.where.id;
        const existing = poStore.get(id) || {};
        const updated = { ...existing, ...(args.create || {}), ...(args.update || {}) };
        poStore.set(id, updated);
        return updated;
      }),
    },
    purchaseOrderItemModel: {
      upsert: jest.fn(async (args: any) => {
        const id = args.where.id;
        const existing = itemStore.get(id) || {};
        const updated = { ...existing, ...(args.create || {}), ...(args.update || {}) };
        itemStore.set(id, updated);
        return updated;
      }),
    },
  };

  return {
    prisma: {
      purchaseOrderModel: {
        deleteMany: jest.fn(async () => {
          poStore.clear();
        }),
        findMany: jest.fn(async (args?: any) => {
          const results: any[] = [];
          for (const po of poStore.values()) {
            const poItems = Array.from(itemStore.values()).filter(i => i.purchaseOrderId === po.id);
            const where = args?.where;
            if (where) {
              if (where.tenantId && po.tenantId !== where.tenantId) continue;
              if (where.status && po.status !== where.status) continue;
              if (where.locationId && po.locationId !== where.locationId) continue;
              if (where.items?.some?.variantId) {
                const targetVariant = where.items.some.variantId;
                if (!poItems.some(i => i.variantId === targetVariant)) continue;
              }
            }
            results.push({ ...po, items: poItems });
          }
          return results;
        }),
      },
      purchaseOrderItemModel: {
        deleteMany: jest.fn(async () => {
          itemStore.clear();
        }),
      },
      $transaction: jest.fn(async (callback: any) => {
        return callback(mockTx);
      }),
      $disconnect: jest.fn(),
    },
  };
});

import { PrismaPurchaseOrderRepository } from "../../../src/infrastructure/database/PrismaPurchaseOrderRepository";
import { PurchaseOrder } from "../../../src/domain/procurement/aggregates/PurchaseOrder";
import { PurchaseOrderItem } from "../../../src/domain/procurement/aggregates/PurchaseOrderItem";
import { PurchaseOrderStatus } from "../../../src/domain/procurement/enums/PurchaseOrderStatus";

describe("PrismaPurchaseOrderRepository Unit Tests", () => {
  let repository: PrismaPurchaseOrderRepository;

  beforeAll(() => {
    repository = new PrismaPurchaseOrderRepository();
  });

  beforeEach(() => {
    poStore.clear();
    itemStore.clear();
    jest.clearAllMocks();
  });

  it("should find received purchase orders by tenant, variant and location", async () => {
    const po = new PurchaseOrder(
      "po-received-1",
      "PO-REC-1",
      "vendor-1",
      "tenant-1",
      "loc-1",
      PurchaseOrderStatus.Received,
      [new PurchaseOrderItem("item-1", "var-1", 10, 100, 10)]
    );
    await repository.save(po);

    const found = await repository.findReceivedByTenantAndVariant("tenant-1", "var-1", "loc-1");
    expect(found).toHaveLength(1);
    expect(found[0].purchaseOrderNumber).toBe("PO-REC-1");

    const notFound = await repository.findReceivedByTenantAndVariant("tenant-1", "var-1", "loc-2");
    expect(notFound).toHaveLength(0);
  });
});
