import { StockOnboarding } from "../../../src/domain/onboarding/aggregates/StockOnboarding";
import { OpeningBalanceService } from "../../../src/domain/onboarding/services/OpeningBalanceService";
import { IInventoryRepository } from "../../../src/domain/repositories/IInventoryRepository";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { InventoryItem } from "../../../src/domain/aggregates/InventoryItem";

describe("OpeningBalanceService", () => {
  let mockRepo: jest.Mocked<IInventoryRepository>;
  let service: OpeningBalanceService;

  beforeEach(() => {
    mockRepo = {
      findBySku: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      hasAnyEntries: jest.fn(),
    } as any;
    service = new OpeningBalanceService(mockRepo);
  });

  it("should post opening balances when onboarding is submitted and no conflicts exist", async () => {
    const onboarding = new StockOnboarding("ob-1", "loc-1", new Date());
    onboarding.setItem("sku-1", 100, 1500);
    onboarding.setItem("sku-2", 50, 2000);
    onboarding.submit();

    mockRepo.hasAnyEntries.mockResolvedValue(false);
    mockRepo.findBySku.mockResolvedValue(null);

    await service.process(onboarding, "actor-1");

    expect(mockRepo.hasAnyEntries).toHaveBeenCalledTimes(2);
    expect(mockRepo.save).toHaveBeenCalledTimes(2);
    
    // Check first item
    const firstSave = mockRepo.save.mock.calls[0][0];
    expect(firstSave.sku.getValue()).toBe("SKU-1");
    expect(firstSave.quantity.getValue()).toBe(100);
  });

  it("should throw error if onboarding is not submitted", async () => {
    const onboarding = new StockOnboarding("ob-1", "loc-1", new Date());
    onboarding.setItem("sku-1", 100, 1500);

    await expect(service.process(onboarding, "actor-1")).rejects.toThrow("Call submit() first");
  });

  it("should throw error if conflicts exist", async () => {
    const onboarding = new StockOnboarding("ob-1", "loc-1", new Date());
    onboarding.setItem("sku-1", 100, 1500);
    onboarding.submit();

    mockRepo.hasAnyEntries.mockResolvedValue(true);

    await expect(service.process(onboarding, "actor-1")).rejects.toThrow("Opening balance conflict");
  });
});
