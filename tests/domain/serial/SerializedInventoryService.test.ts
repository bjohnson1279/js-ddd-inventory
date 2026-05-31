import { SerializedInventoryService } from "../../../src/domain/serial/services/SerializedInventoryService";
import { InMemorySerializedItemRepository } from "../../../src/infrastructure/database/InMemorySerializedItemRepository";
import { InMemoryInventoryRepository } from "../../../src/infrastructure/database/InMemoryInventoryRepository";
import { SerialNumber } from "../../../src/domain/serial/valueObjects/SerialNumber";
import { SerializedItemStatus } from "../../../src/domain/serial/enums/SerializedItemStatus";
import { SerialNumberAlreadyRegisteredException } from "../../../src/domain/serial/exceptions/SerialNumberAlreadyRegisteredException";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";

describe("SerializedInventoryService", () => {
  let serialsRepo: InMemorySerializedItemRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let service: SerializedInventoryService;

  beforeEach(() => {
    serialsRepo = new InMemorySerializedItemRepository();
    inventoryRepo = new InMemoryInventoryRepository();
    service = new SerializedInventoryService(serialsRepo, inventoryRepo);
  });

  it("should register a pending serial number", async () => {
    const sn = new SerialNumber("SN-1");
    const item = await service.register(sn, "SKU-A", "TEN-1", "LOC-1", "user-1");

    expect(item.status).toBe(SerializedItemStatus.Pending);
    expect(await serialsRepo.isRegistered(sn, "TEN-1")).toBe(true);

    await expect(service.register(sn, "SKU-A", "TEN-1", "LOC-1", "user-1")).rejects.toThrow(
      SerialNumberAlreadyRegisteredException
    );
  });

  it("should receive a pending serial and increment ledger", async () => {
    const sn = new SerialNumber("SN-1");
    await service.register(sn, "SKU-A", "TEN-1", "LOC-1", "user-1");

    await service.receive(sn, "TEN-1", "LOC-1", "PO-1", "user-1");

    const item = await serialsRepo.findBySerialOrFail(sn, "TEN-1");
    expect(item.status).toBe(SerializedItemStatus.InStock);

    const invItem = await inventoryRepo.findBySku(SKU.create("SKU-A"));
    expect(invItem?.quantity.getValue()).toBe(1);
  });

  it("should sell an InStock serial and decrement ledger", async () => {
    const sn = new SerialNumber("SN-1");
    await service.register(sn, "SKU-A", "TEN-1", "LOC-1", "user-1");
    await service.receive(sn, "TEN-1", "LOC-1", "PO-1", "user-1");

    await service.sell(sn, "TEN-1", "SALE-1", "user-2");

    const item = await serialsRepo.findBySerialOrFail(sn, "TEN-1");
    expect(item.status).toBe(SerializedItemStatus.Sold);

    const invItem = await inventoryRepo.findBySku(SKU.create("SKU-A"));
    expect(invItem?.quantity.getValue()).toBe(0);
  });

  it("should return a sold serial without changing the ledger", async () => {
    const sn = new SerialNumber("SN-1");
    await service.register(sn, "SKU-A", "TEN-1", "LOC-1", "user-1");
    await service.receive(sn, "TEN-1", "LOC-1", "PO-1", "user-1");
    await service.sell(sn, "TEN-1", "SALE-1", "user-2");

    await service.acceptReturn(sn, "TEN-1", "RET-1", "user-3");

    const item = await serialsRepo.findBySerialOrFail(sn, "TEN-1");
    expect(item.status).toBe(SerializedItemStatus.Returned);

    const invItem = await inventoryRepo.findBySku(SKU.create("SKU-A"));
    expect(invItem?.quantity.getValue()).toBe(0);
  });

  it("should restock a returned serial and increment ledger", async () => {
    const sn = new SerialNumber("SN-1");
    await service.register(sn, "SKU-A", "TEN-1", "LOC-1", "user-1");
    await service.receive(sn, "TEN-1", "LOC-1", "PO-1", "user-1");
    await service.sell(sn, "TEN-1", "SALE-1", "user-2");
    await service.acceptReturn(sn, "TEN-1", "RET-1", "user-3");

    await service.restock(sn, "TEN-1", "RET-1", "user-4");

    const item = await serialsRepo.findBySerialOrFail(sn, "TEN-1");
    expect(item.status).toBe(SerializedItemStatus.InStock);

    const invItem = await inventoryRepo.findBySku(SKU.create("SKU-A"));
    expect(invItem?.quantity.getValue()).toBe(1);
  });

  it("should handle write-offs properly based on original stock state", async () => {
    const sn1 = new SerialNumber("SN-1");
    const sn2 = new SerialNumber("SN-2");

    await service.register(sn1, "SKU-A", "TEN-1", "LOC-1", "user-1");
    await service.receive(sn1, "TEN-1", "LOC-1", "PO-1", "user-1");
    await service.writeOff(sn1, "TEN-1", "Broken", "user-2");

    let invItem = await inventoryRepo.findBySku(SKU.create("SKU-A"));
    expect(invItem?.quantity.getValue()).toBe(0);

    await service.register(sn2, "SKU-A", "TEN-1", "LOC-1", "user-1");
    await service.receive(sn2, "TEN-1", "LOC-1", "PO-1", "user-1");
    await service.sell(sn2, "TEN-1", "SALE-1", "user-2");
    await service.acceptReturn(sn2, "TEN-1", "RET-1", "user-3");
    await service.writeOff(sn2, "TEN-1", "Scrapped", "user-4");

    invItem = await inventoryRepo.findBySku(SKU.create("SKU-A"));
    expect(invItem?.quantity.getValue()).toBe(0);
  });

  it("should check consistency with inventory ledger", async () => {
    const sn = new SerialNumber("SN-1");
    await service.register(sn, "SKU-A", "TEN-1", "LOC-1", "user-1");

    expect(await service.isConsistentWithLedger("SKU-A")).toBe(true);

    await service.receive(sn, "TEN-1", "LOC-1", "PO-1", "user-1");
    expect(await service.isConsistentWithLedger("SKU-A")).toBe(true);

    const invItem = await inventoryRepo.findBySku(SKU.create("SKU-A"));
    invItem?.receiveStock(Quantity.create(5));
    if (invItem) await inventoryRepo.save(invItem);

    expect(await service.isConsistentWithLedger("SKU-A")).toBe(false);
  });
});
