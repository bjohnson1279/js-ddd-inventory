import { AuthorizeRMA } from "../../../src/application/useCases/AuthorizeRMA";
import { InMemoryRMARepository } from "../../../src/infrastructure/database/InMemoryRMARepository";
import { RMA } from "../../../src/domain/returns/aggregates/RMA";
import { RMAStatus } from "../../../src/domain/returns/enums/RMAStatus";

describe("AuthorizeRMA Use Case", () => {
  let rmaRepository: InMemoryRMARepository;
  let authorizeRmaUseCase: AuthorizeRMA;

  beforeEach(() => {
    rmaRepository = new InMemoryRMARepository();
    authorizeRmaUseCase = new AuthorizeRMA(rmaRepository);
  });

  it("should successfully authorize a requested RMA", async () => {
    // 1. Setup RMA
    const rma = new RMA(
      "RMA-ID-1",
      "RMA-100",
      "TEN-1",
      "CUST-1",
      "LOC-1",
      RMAStatus.Requested,
      []
    );
    await rmaRepository.save(rma);

    // 2. Execute use case
    await authorizeRmaUseCase.execute("RMA-ID-1");

    // 3. Verify state change
    const updatedRma = await rmaRepository.findById("RMA-ID-1");
    expect(updatedRma).not.toBeNull();
    expect(updatedRma?.status).toBe(RMAStatus.Authorized);
  });

  it("should throw an error if RMA does not exist", async () => {
    // Attempt to authorize an unknown RMA
    await expect(authorizeRmaUseCase.execute("UNKNOWN-ID")).rejects.toThrow(
      "RMA with ID UNKNOWN-ID not found."
    );
  });

  it("should throw an error if RMA is not in requested state", async () => {
    // 1. Setup RMA in a non-requested state
    const rma = new RMA(
      "RMA-ID-2",
      "RMA-200",
      "TEN-1",
      "CUST-1",
      "LOC-1",
      RMAStatus.Authorized,
      []
    );
    await rmaRepository.save(rma);

    // 2. Execute use case and expect it to fail
    await expect(authorizeRmaUseCase.execute("RMA-ID-2")).rejects.toThrow(
      "Only requested RMAs can be authorized."
    );
  });
});
