import { InventoryService } from "../../../src/domain/services/InventoryService";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { Kit } from "../../../src/domain/kit/aggregates/Kit";
import { InsufficientInventoryException } from "../../../src/domain/exceptions/InsufficientInventoryException";

describe("InventoryService Direct & Kit Sales", () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let service: InventoryService;

  beforeEach(() => {
    inventoryRepo = new InMemoryInventoryRepository();
    service = new InventoryService(inventoryRepo);
  });

  it("should decrement stock for a direct sale if sufficient stock exists", async () => {
    const item = InventoryItem.create("1", SKU.create("SKU-1"), Quantity.create(10));
    await inventoryRepo.save(item);

    await service.decrementForSale("SKU-1", 3, "SALE-100", "actor-1");

    const updated = await inventoryRepo.findBySku(SKU.create("SKU-1"));
    expect(updated?.quantity.getValue()).toBe(7);
  });

  it("should throw InsufficientInventoryException for sale if stock is insufficient", async () => {
    const item = InventoryItem.create("1", SKU.create("SKU-1"), Quantity.create(2));
    await inventoryRepo.save(item);

    await expect(service.decrementForSale("SKU-1", 3, "SALE-100", "actor-1")).rejects.toThrow(
      InsufficientInventoryException
    );
  });

  it("should throw an error if attempting to sell an empty kit", async () => {
    const kit = new Kit("KIT-EMPTY", SKU.create("BUNDLE-EMPTY"), "Empty Kit");

    await expect(service.decrementForKitSale(kit, 1, "SALE-EMPTY-KIT", "actor-1")).rejects.toThrow(
      "Cannot sell a kit with no components."
    );
  });

  it("should decrement all component quantities for a kit sale", async () => {
    const compA = InventoryItem.create("1", SKU.create("COMP-A"), Quantity.create(10));
    const compB = InventoryItem.create("2", SKU.create("COMP-B"), Quantity.create(20));
    await inventoryRepo.save(compA);
    await inventoryRepo.save(compB);

    const kit = new Kit("KIT-1", SKU.create("BUNDLE-STARTER"), "Starter");
    kit.addComponent("COMP-A", 2);
    kit.addComponent("COMP-B", 3);

    await service.decrementForKitSale(kit, 3, "SALE-KIT-1", "actor-1");

    const updatedA = await inventoryRepo.findBySku(SKU.create("COMP-A"));
    const updatedB = await inventoryRepo.findBySku(SKU.create("COMP-B"));

    expect(updatedA?.quantity.getValue()).toBe(4);
    expect(updatedB?.quantity.getValue()).toBe(11);
  });

  it("should throw InsufficientInventoryException and perform no partial decrements if one component fails stock check", async () => {
    const compA = InventoryItem.create("1", SKU.create("COMP-A"), Quantity.create(10));
    const compB = InventoryItem.create("2", SKU.create("COMP-B"), Quantity.create(2));
    await inventoryRepo.save(compA);
    await inventoryRepo.save(compB);

    const kit = new Kit("KIT-1", SKU.create("BUNDLE-STARTER"), "Starter");
    kit.addComponent("COMP-A", 2);
    kit.addComponent("COMP-B", 3);

    await expect(service.decrementForKitSale(kit, 2, "SALE-KIT-1", "actor-1")).rejects.toThrow(
      InsufficientInventoryException
    );

    const updatedA = await inventoryRepo.findBySku(SKU.create("COMP-A"));
    expect(updatedA?.quantity.getValue()).toBe(10);

    const updatedB = await inventoryRepo.findBySku(SKU.create("COMP-B"));
    expect(updatedB?.quantity.getValue()).toBe(2);
  });
});
