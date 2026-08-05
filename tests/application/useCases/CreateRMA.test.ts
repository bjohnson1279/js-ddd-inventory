import { CreateRMA, CreateRMADTO } from "../../../src/application/useCases/CreateRMA";
import { InMemoryRMARepository } from "../../../src/infrastructure/database/InMemoryRMARepository";
import { RMA } from "../../../src/domain/returns/aggregates/RMA";
import { RMAStatus } from "../../../src/domain/returns/enums/RMAStatus";

describe("CreateRMA Use Case", () => {
  let rmaRepository: InMemoryRMARepository;
  let createRMA: CreateRMA;

  beforeEach(() => {
    rmaRepository = new InMemoryRMARepository();
    createRMA = new CreateRMA(rmaRepository);
  });

  it("should successfully create a new RMA", async () => {
    const dto: CreateRMADTO = {
      rmaNumber: "RMA-123",
      tenantId: "tenant-1",
      customerId: "cust-1",
      locationId: "loc-1",
      items: [
        {
          variantId: "var-1",
          quantity: 2,
          unitCostCents: 1500,
        }
      ]
    };

    const rma = await createRMA.execute(dto);

    expect(rma).toBeDefined();
    expect(rma.rmaNumber).toBe("RMA-123");
    expect(rma.tenantId).toBe("tenant-1");
    expect(rma.customerId).toBe("cust-1");
    expect(rma.locationId).toBe("loc-1");
    expect(rma.status).toBe(RMAStatus.Requested);
    expect(rma.items.length).toBe(1);
    expect(rma.items[0].variantId).toBe("var-1");
    expect(rma.items[0].quantity).toBe(2);
    expect(rma.items[0].unitCostCents).toBe(1500);

    const savedRMA = await rmaRepository.findById(rma.id);
    expect(savedRMA).toBeDefined();
    expect(savedRMA?.rmaNumber).toBe("RMA-123");
  });

  it("should throw an error if RMA with the same number already exists", async () => {
    const existingRMA = new RMA(
      "existing-id",
      "RMA-456",
      "tenant-1",
      "cust-2",
      "loc-1",
      RMAStatus.Requested,
      []
    );
    await rmaRepository.save(existingRMA);

    const dto: CreateRMADTO = {
      rmaNumber: "RMA-456",
      tenantId: "tenant-1",
      customerId: "cust-1",
      locationId: "loc-1",
      items: []
    };

    await expect(createRMA.execute(dto)).rejects.toThrow(
      "RMA with number RMA-456 already exists."
    );
  });
});
