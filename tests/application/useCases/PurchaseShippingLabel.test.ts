import { PurchaseShippingLabel, PurchaseShippingLabelCommand } from "../../../src/application/useCases/PurchaseShippingLabel";
import { IShipmentRepository } from "../../../src/domain/repositories/IShipmentRepository";
import { ICarrierService, LabelResult } from "../../../src/application/ports/ICarrierService";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { IDispatchRecordRepository } from "../../../src/domain/repositories/IDispatchRecordRepository";
import { ITenantConfigRepository } from "../../../src/domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../../src/domain/repositories/IJournalRepository";
import { IOutboxRepository } from "../../../src/domain/repositories/IOutboxRepository";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import { AccountingMethod } from "../../../src/domain/accounting/enums/AccountingMethod";

describe("PurchaseShippingLabel Use Case", () => {
  let mockShipmentRepository: jest.Mocked<IShipmentRepository>;
  let mockCarrierService: jest.Mocked<ICarrierService>;
  let mockInventoryRepository: jest.Mocked<IInventoryRepository>;
  let mockDispatchRecordRepository: jest.Mocked<IDispatchRecordRepository>;
  let mockTenantConfigRepository: jest.Mocked<ITenantConfigRepository>;
  let mockJournalRepository: jest.Mocked<IJournalRepository>;
  let mockOutboxRepository: jest.Mocked<IOutboxRepository>;
  let useCase: PurchaseShippingLabel;

  beforeEach(() => {
    mockShipmentRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
    };
    mockCarrierService = {
      fetchRates: jest.fn(),
      generateLabel: jest.fn(),
    };
    mockInventoryRepository = {
      findBySku: jest.fn(),
      findAllBySku: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      findAllByLocation: jest.fn(),
      hasAnyEntries: jest.fn(),
    };
    mockDispatchRecordRepository = {
      save: jest.fn(),
      fetchHistory: jest.fn(),
      fetchByLotNumber: jest.fn(),
    };
    mockTenantConfigRepository = {
      findByTenantId: jest.fn(),
      save: jest.fn(),
    };
    mockJournalRepository = {
      save: jest.fn(),
      findAll: jest.fn(),
    };
    mockOutboxRepository = {
      save: jest.fn(),
      fetchPending: jest.fn(),
      markProcessed: jest.fn(),
      markFailed: jest.fn(),
      fetchDeadLettered: jest.fn(),
      retryEvent: jest.fn(),
      fetchStats: jest.fn(),
    };

    useCase = new PurchaseShippingLabel(
      mockShipmentRepository,
      mockCarrierService,
      mockInventoryRepository,
      mockDispatchRecordRepository,
      mockTenantConfigRepository,
      mockJournalRepository,
      mockOutboxRepository
    );

    jest.useFakeTimers().setSystemTime(new Date("2023-01-01T00:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should fail if required parameters are missing", async () => {
    const command = {
      sku: "SKU-1",
      quantity: 5,
      destinationAddress: "123 St",
      carrier: "UPS",
      locationId: "loc-1",
      // missing tenantId
    } as PurchaseShippingLabelCommand;

    await expect(useCase.execute(command)).rejects.toThrow("Missing required parameters for shipping label purchase.");
  });

  it("should fail if inventory item is not found", async () => {
    mockInventoryRepository.findBySku.mockResolvedValue(null);

    const command: PurchaseShippingLabelCommand = {
      sku: "SKU-1",
      quantity: 5,
      destinationAddress: "123 St",
      carrier: "UPS",
      locationId: "loc-1",
      tenantId: "tenant-1"
    };

    await expect(useCase.execute(command)).rejects.toThrow("Inventory item not found for SKU SKU-1 at location loc-1.");
  });

  it("should fail if insufficient stock", async () => {
    const item = InventoryItem.create("item-1", SKU.create("SKU-1"), "loc-1", Quantity.create(3));
    mockInventoryRepository.findBySku.mockResolvedValue(item);

    const command: PurchaseShippingLabelCommand = {
      sku: "SKU-1",
      quantity: 5,
      destinationAddress: "123 St",
      carrier: "UPS",
      locationId: "loc-1",
      tenantId: "tenant-1"
    };

    await expect(useCase.execute(command)).rejects.toThrow("Insufficient stock for SKU SKU-1. On-hand: 3, Requested: 5");
  });

  it("should purchase shipping label successfully with Accrual accounting", async () => {
    const item = InventoryItem.create("item-1", SKU.create("SKU-1"), "loc-1", Quantity.create(10));
    mockInventoryRepository.findBySku.mockResolvedValue(item);

    const labelResult: LabelResult = {
      trackingNumber: "TRACK123",
      labelUrl: "http://label.url",
      rateCents: 1500
    };
    mockCarrierService.generateLabel.mockResolvedValue(labelResult);

    mockTenantConfigRepository.findByTenantId.mockResolvedValue({
      id: "config-1",
      tenantId: "tenant-1",
      accountingMethod: AccountingMethod.Accrual,
    } as any);

    const command: PurchaseShippingLabelCommand = {
      sku: "SKU-1",
      quantity: 5,
      destinationAddress: "123 St",
      carrier: "UPS",
      locationId: "loc-1",
      tenantId: "tenant-1"
    };

    const result = await useCase.execute(command);

    expect(result.trackingNumber).toBe("TRACK123");
    expect(result.rateCents).toBe(1500);

    expect(mockInventoryRepository.save).toHaveBeenCalledTimes(1);
    expect(item.quantity.getValue()).toBe(5);

    expect(mockDispatchRecordRepository.save).toHaveBeenCalledTimes(1);
    expect(mockShipmentRepository.save).toHaveBeenCalledTimes(1);

    expect(mockJournalRepository.save).toHaveBeenCalledTimes(1);
    const journalEntry = mockJournalRepository.save.mock.calls[0][0] as any;
    expect(journalEntry.lines[0].account.code).toBe("5400"); // Debit expense
    expect(journalEntry.lines[1].account.code).toBe("2100"); // Credit liability

    expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
  });

  it("should purchase shipping label successfully with Cash accounting", async () => {
    const item = InventoryItem.create("item-1", SKU.create("SKU-1"), "loc-1", Quantity.create(10));
    mockInventoryRepository.findBySku.mockResolvedValue(item);

    const labelResult: LabelResult = {
      trackingNumber: "TRACK123",
      labelUrl: "http://label.url",
      rateCents: 1500
    };
    mockCarrierService.generateLabel.mockResolvedValue(labelResult);

    mockTenantConfigRepository.findByTenantId.mockResolvedValue({
      id: "config-1",
      tenantId: "tenant-1",
      accountingMethod: AccountingMethod.Cash,
    } as any);

    const command: PurchaseShippingLabelCommand = {
      sku: "SKU-1",
      quantity: 5,
      destinationAddress: "123 St",
      carrier: "UPS",
      locationId: "loc-1",
      tenantId: "tenant-1"
    };

    await useCase.execute(command);

    expect(mockJournalRepository.save).toHaveBeenCalledTimes(1);
    const journalEntry = mockJournalRepository.save.mock.calls[0][0] as any;
    expect(journalEntry.lines[0].account.code).toBe("5400"); // Debit expense
    expect(journalEntry.lines[1].account.code).toBe("1000"); // Credit cash
  });
});
