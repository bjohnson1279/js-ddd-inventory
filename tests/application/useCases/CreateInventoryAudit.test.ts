import { CreateInventoryAudit, CreateInventoryAuditDTO } from "../../../src/application/useCases/CreateInventoryAudit";
import { IInventoryAuditRepository } from "../../../src/domain/repositories/IInventoryAuditRepository";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { InventoryAudit } from "../../../src/domain/procurement/aggregates/InventoryAudit";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";
import crypto from "crypto";

// Mock crypto module
jest.mock("crypto", () => ({
  randomUUID: jest.fn(),
}));

describe("CreateInventoryAudit Use Case", () => {
  let mockAuditRepository: jest.Mocked<IInventoryAuditRepository>;
  let mockInventoryRepository: jest.Mocked<IInventoryRepository>;
  let useCase: CreateInventoryAudit;

  beforeEach(() => {
    mockAuditRepository = {
      findByNumber: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByStatus: jest.fn(),
      findAll: jest.fn()
    } as any;

    mockInventoryRepository = {
      findBySku: jest.fn(),
      save: jest.fn(),
      findAllByLocation: jest.fn(),
      findBySkus: jest.fn()
    } as any;

    useCase = new CreateInventoryAudit(mockAuditRepository, mockInventoryRepository);

    (crypto.randomUUID as jest.Mock).mockReturnValue("mocked-uuid");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const validDto: CreateInventoryAuditDTO = {
    auditNumber: "AUDIT-001",
    tenantId: "tenant-1",
    locationId: "loc-1"
  };

  it("should throw an error if an audit with the same number already exists", async () => {
    mockAuditRepository.findByNumber.mockResolvedValue({} as InventoryAudit);

    await expect(useCase.execute(validDto)).rejects.toThrow("Inventory audit with number AUDIT-001 already exists.");
  });

  it("should create an audit for all variants in location when variantIds is undefined", async () => {
    mockAuditRepository.findByNumber.mockResolvedValue(null);

    const sku1 = SKU.create("SKU-1");
    const sku2 = SKU.create("SKU-2");

    const item1 = InventoryItem.create("id1", sku1, "loc-1", Quantity.create(10));
    const item2 = InventoryItem.create("id2", sku2, "loc-1", Quantity.create(20));

    mockInventoryRepository.findAllByLocation.mockResolvedValue([item1, item2]);

    const result = await useCase.execute(validDto);

    expect(mockInventoryRepository.findAllByLocation).toHaveBeenCalledWith("loc-1");
    expect(result).toBeInstanceOf(InventoryAudit);
    expect(result.auditNumber).toBe("AUDIT-001");
    expect(result.items.length).toBe(2);
    expect(result.items[0].variantId).toBe("SKU-1");
    expect(result.items[0].expectedQuantity).toBe(10);
    expect(result.items[1].variantId).toBe("SKU-2");
    expect(result.items[1].expectedQuantity).toBe(20);
    expect(mockAuditRepository.save).toHaveBeenCalledWith(result);
  });

  it("should create an audit for all variants in location when variantIds is empty array", async () => {
    mockAuditRepository.findByNumber.mockResolvedValue(null);

    const sku1 = SKU.create("SKU-1");

    const item1 = InventoryItem.create("id1", sku1, "loc-1", Quantity.create(10));

    mockInventoryRepository.findAllByLocation.mockResolvedValue([item1]);

    const result = await useCase.execute({...validDto, variantIds: []});

    expect(mockInventoryRepository.findAllByLocation).toHaveBeenCalledWith("loc-1");
    expect(result.items.length).toBe(1);
  });

  it("should create an audit for specific variantIds using findBySkus when available", async () => {
    mockAuditRepository.findByNumber.mockResolvedValue(null);

    const sku1 = SKU.create("SKU-1");

    const item1 = InventoryItem.create("id1", sku1, "loc-1", Quantity.create(10));

    (mockInventoryRepository.findBySkus as jest.Mock).mockResolvedValue([item1]);

    const dto = { ...validDto, variantIds: ["SKU-1", "SKU-2"] };

    const result = await useCase.execute(dto);

    expect(mockInventoryRepository.findBySkus).toHaveBeenCalled();
    const calledSkus = (mockInventoryRepository.findBySkus as jest.Mock).mock.calls[0][0] as SKU[];
    expect(calledSkus.length).toBe(2);
    expect(calledSkus[0].getValue()).toBe("SKU-1");
    expect(calledSkus[1].getValue()).toBe("SKU-2");

    expect(result.items.length).toBe(2);

    const auditItem1 = result.items.find(i => i.variantId === "SKU-1");
    expect(auditItem1?.expectedQuantity).toBe(10);

    const auditItem2 = result.items.find(i => i.variantId === "SKU-2");
    expect(auditItem2?.expectedQuantity).toBe(0); // not found in inventory

    expect(mockAuditRepository.save).toHaveBeenCalledWith(result);
  });

  it("should create an audit for specific variantIds falling back to findBySku when findBySkus is not available", async () => {
    mockAuditRepository.findByNumber.mockResolvedValue(null);

    // Remove findBySkus to test fallback
    const { findBySkus, ...repoWithoutFindBySkus } = mockInventoryRepository;
    useCase = new CreateInventoryAudit(mockAuditRepository, repoWithoutFindBySkus as any);

    const sku1 = SKU.create("SKU-1");
    const item1 = InventoryItem.create("id1", sku1, "loc-1", Quantity.create(10));

    // @ts-ignore
    repoWithoutFindBySkus.findBySku.mockImplementation((sku: SKU, loc: string) => {
      if (sku.getValue() === "SKU-1") return Promise.resolve(item1);
      return Promise.resolve(null);
    });

    const dto = { ...validDto, variantIds: ["SKU-1", "SKU-2"] };

    const result = await useCase.execute(dto);

    // @ts-ignore
    expect(repoWithoutFindBySkus.findBySku).toHaveBeenCalledTimes(2);

    expect(result.items.length).toBe(2);

    const auditItem1 = result.items.find(i => i.variantId === "SKU-1");
    expect(auditItem1?.expectedQuantity).toBe(10);

    const auditItem2 = result.items.find(i => i.variantId === "SKU-2");
    expect(auditItem2?.expectedQuantity).toBe(0); // not found in inventory
  });
});
