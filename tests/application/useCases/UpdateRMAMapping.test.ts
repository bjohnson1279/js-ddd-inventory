import { UpdateRMAMapping } from "../../../src/application/useCases/UpdateRMAMapping";
import { InMemoryRMARepository } from "../../../src/infrastructure/database/InMemoryRMARepository";
import { RMA } from "../../../src/domain/returns/aggregates/RMA";
import { RMAStatus } from "../../../src/domain/returns/enums/RMAStatus";

describe("UpdateRMAMapping Use Case", () => {
  let rmaRepository: InMemoryRMARepository;
  let updateRMAMapping: UpdateRMAMapping;

  beforeEach(() => {
    rmaRepository = new InMemoryRMARepository();
    updateRMAMapping = new UpdateRMAMapping(rmaRepository);
  });

  it("should update RMA mapping for an existing RMA", async () => {
    const rma = new RMA(
      "rma-123",
      "RMA-001",
      "tenant-1",
      "cust-1",
      "wh-old",
      RMAStatus.Requested
    );
    await rmaRepository.save(rma);

    await updateRMAMapping.execute({
      rmaNumber: "RMA-001",
      warehouseId: "wh-new",
    });

    const updatedRma = await rmaRepository.findById("rma-123");
    expect(updatedRma).not.toBeNull();
    expect(updatedRma?.locationId).toBe("wh-new");
  });

  it("should throw an error if RMA is not found", async () => {
    await expect(
      updateRMAMapping.execute({
        rmaNumber: "NON-EXISTENT",
        warehouseId: "wh-new",
      })
    ).rejects.toThrow("RMA NON-EXISTENT not found");
  });
});
