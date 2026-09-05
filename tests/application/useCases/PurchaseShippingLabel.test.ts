import { PurchaseShippingLabel, PurchaseShippingLabelCommand } from "../../../src/application/useCases/PurchaseShippingLabel";
import { IShipmentRepository } from "../../../src/domain/repositories/IShipmentRepository";
import { ICarrierService } from "../../../src/application/ports/ICarrierService";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { IDispatchRecordRepository } from "../../../src/domain/repositories/IDispatchRecordRepository";
import { ITenantConfigRepository } from "../../../src/domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../../src/domain/repositories/IJournalRepository";
import { IOutboxRepository } from "../../../src/domain/repositories/IOutboxRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";

describe("PurchaseShippingLabel Use Case", () => {
  let shipmentRepository: jest.Mocked<IShipmentRepository>;
  let carrierService: jest.Mocked<ICarrierService>;
  let inventoryRepository: jest.Mocked<IInventoryRepository>;
  let dispatchRecordRepository: jest.Mocked<IDispatchRecordRepository>;
  let tenantConfigRepository: jest.Mocked<ITenantConfigRepository>;
  let journalRepository: jest.Mocked<IJournalRepository>;
  let outboxRepository: jest.Mocked<IOutboxRepository>;

  let useCase: PurchaseShippingLabel;

  beforeEach(() => {
    shipmentRepository = { save: jest.fn(), findById: jest.fn(), findByTrackingNumber: jest.fn(), findAllByLocation: jest.fn() } as any;
    carrierService = { generateLabel: jest.fn(), fetchRates: jest.fn() };
    inventoryRepository = { save: jest.fn(), findById: jest.fn(), findBySku: jest.fn(), getLowStockItems: jest.fn() } as any;
    dispatchRecordRepository = { save: jest.fn(), findByLocation: jest.fn(), findBySku: jest.fn() } as any;
    tenantConfigRepository = { save: jest.fn(), findByTenantId: jest.fn(), findAll: jest.fn() } as any;
    journalRepository = { save: jest.fn(), findById: jest.fn(), findByTenantId: jest.fn(), findByReferenceId: jest.fn() } as any;
    outboxRepository = { save: jest.fn(), findUnpublished: jest.fn(), markAsPublished: jest.fn() } as any;

    useCase = new PurchaseShippingLabel(
      shipmentRepository,
      carrierService,
      inventoryRepository,
      dispatchRecordRepository,
      tenantConfigRepository,
      journalRepository,
      outboxRepository
    );
  });

  const validCommand: PurchaseShippingLabelCommand = {
    sku: "SKU-123",
    quantity: 2,
    destinationAddress: "123 Test St",
    carrier: "UPS",
    locationId: "LOC-1",
    tenantId: "TENANT-1"
  };

  it("should throw error if required parameters are missing", async () => {
    await expect(useCase.execute({ ...validCommand, sku: "" }))
      .rejects.toThrow("Missing required parameters for shipping label purchase.");
  });

  it("should throw error if inventory item is not found", async () => {
    inventoryRepository.findBySku.mockResolvedValue(null);
    await expect(useCase.execute(validCommand))
      .rejects.toThrow("Inventory item not found for SKU SKU-123 at location LOC-1.");
  });

  it("should throw error if insufficient stock", async () => {
    const mockInventoryItem = {
      quantity: { getValue: () => 1 },
      dispatchStock: jest.fn()
    };
    inventoryRepository.findBySku.mockResolvedValue(mockInventoryItem as any);

    await expect(useCase.execute(validCommand))
      .rejects.toThrow("Insufficient stock for SKU SKU-123. On-hand: 1, Requested: 2");
  });

  it("should successfully generate label with Accrual accounting", async () => {
    const mockInventoryItem = {
      quantity: { getValue: () => 10 },
      dispatchStock: jest.fn()
    };
    inventoryRepository.findBySku.mockResolvedValue(mockInventoryItem as any);
    carrierService.generateLabel.mockResolvedValue({ trackingNumber: "TRACK123", labelUrl: "http://label", rateCents: 1500 });
    tenantConfigRepository.findByTenantId.mockResolvedValue({ accountingMethod: AccountingMethod.Accrual } as any);

    const result = await useCase.execute(validCommand);

    expect(result.trackingNumber).toBe("TRACK123");
    expect(mockInventoryItem.dispatchStock).toHaveBeenCalled();
    expect(inventoryRepository.save).toHaveBeenCalledWith(mockInventoryItem);
    expect(carrierService.generateLabel).toHaveBeenCalledWith("SKU-123", 2, "123 Test St", "UPS");
    expect(shipmentRepository.save).toHaveBeenCalled();
    expect(dispatchRecordRepository.save).toHaveBeenCalled();
    expect(journalRepository.save).toHaveBeenCalled();
    expect(outboxRepository.save).toHaveBeenCalled();
  });

  it("should successfully generate label with Cash accounting", async () => {
    const mockInventoryItem = {
      quantity: { getValue: () => 10 },
      dispatchStock: jest.fn()
    };
    inventoryRepository.findBySku.mockResolvedValue(mockInventoryItem as any);
    carrierService.generateLabel.mockResolvedValue({ trackingNumber: "TRACK123", labelUrl: "http://label", rateCents: 1500 });
    tenantConfigRepository.findByTenantId.mockResolvedValue({ accountingMethod: AccountingMethod.Cash } as any);

    const result = await useCase.execute(validCommand);

    expect(result.trackingNumber).toBe("TRACK123");
    expect(journalRepository.save).toHaveBeenCalled();
  });

  it("should successfully generate label without tenant config", async () => {
    const mockInventoryItem = {
      quantity: { getValue: () => 10 },
      dispatchStock: jest.fn()
    };
    inventoryRepository.findBySku.mockResolvedValue(mockInventoryItem as any);
    carrierService.generateLabel.mockResolvedValue({ trackingNumber: "TRACK123", labelUrl: "http://label", rateCents: 1500 });
    tenantConfigRepository.findByTenantId.mockResolvedValue(null);

    const result = await useCase.execute(validCommand);

    expect(result.trackingNumber).toBe("TRACK123");
    expect(journalRepository.save).not.toHaveBeenCalled();
  });
});
