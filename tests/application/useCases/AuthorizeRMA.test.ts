import { AuthorizeRMA } from "../../../src/application/useCases/AuthorizeRMA";
import { InMemoryRMARepository } from "../../../src/infrastructure/database/InMemoryRMARepository";
import { RMA } from "../../../src/domain/returns/aggregates/RMA";
import { RMAStatus } from "../../../src/domain/returns/enums/RMAStatus";

describe("AuthorizeRMA Use Case", () => {
  let rmaRepository: InMemoryRMARepository;
  let authorizeRMA: AuthorizeRMA;

  beforeEach(() => {
    rmaRepository = new InMemoryRMARepository();
    authorizeRMA = new AuthorizeRMA(rmaRepository);
  });

  it("should authorize an existing RMA and save it", async () => {
    const rma = new RMA(
      "rma-1",
      "RMA-001",
      "tenant-1",
      "cust-1",
      "loc-1",
      RMAStatus.Requested
    );
    await rmaRepository.save(rma);

    await authorizeRMA.execute("rma-1");

    const updatedRMA = await rmaRepository.findById("rma-1");
    expect(updatedRMA).not.toBeNull();
    expect(updatedRMA?.status).toBe(RMAStatus.Authorized);
  });

  it("should throw an error if the RMA does not exist", async () => {
    await expect(authorizeRMA.execute("non-existent-rma")).rejects.toThrow(
      "RMA with ID non-existent-rma not found."
    );
  });

  it("should throw an error if the RMA is already authorized", async () => {
    const rma = new RMA(
      "rma-2",
      "RMA-002",
      "tenant-1",
      "cust-1",
      "loc-1",
      RMAStatus.Authorized
    );
    await rmaRepository.save(rma);

    await expect(authorizeRMA.execute("rma-2")).rejects.toThrow(
      "Only requested RMAs can be authorized."
    );
  });
});
