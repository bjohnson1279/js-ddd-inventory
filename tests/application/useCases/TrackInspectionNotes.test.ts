import { TrackInspectionNotes } from "../../../src/application/useCases/TrackInspectionNotes";

describe("TrackInspectionNotes Use Case", () => {
  let mockRmaRepository: any;
  let useCase: TrackInspectionNotes;

  beforeEach(() => {
    mockRmaRepository = {
      get: jest.fn(),
      trackInspectionNotes: jest.fn(),
    };
    useCase = new TrackInspectionNotes(mockRmaRepository);
  });

  it("should track inspection notes successfully when RMA and item exist", async () => {
    const rma = {
      rmaNumber: "RMA-1001",
      items: [{ id: "item-1" }, { id: "item-2" }],
    };
    mockRmaRepository.get.mockResolvedValue(rma);

    await useCase.execute({
      rmaNumber: "RMA-1001",
      itemId: "item-1",
      notes: "Item damaged in transit",
    });

    expect(mockRmaRepository.get).toHaveBeenCalledWith("RMA-1001");
    expect(mockRmaRepository.trackInspectionNotes).toHaveBeenCalledWith("RMA-1001", {
      itemId: "item-1",
      notes: "Item damaged in transit",
    });
  });

  it("should throw error if RMA is not found", async () => {
    mockRmaRepository.get.mockResolvedValue(null);

    await expect(
      useCase.execute({
        rmaNumber: "RMA-9999",
        itemId: "item-1",
        notes: "Item damaged",
      })
    ).rejects.toThrow("RMA RMA-9999 not found");
  });

  it("should throw error if item is not found in RMA", async () => {
    const rma = {
      rmaNumber: "RMA-1001",
      items: [{ id: "item-1" }],
    };
    mockRmaRepository.get.mockResolvedValue(rma);

    await expect(
      useCase.execute({
        rmaNumber: "RMA-1001",
        itemId: "item-2",
        notes: "Item damaged",
      })
    ).rejects.toThrow("Item item-2 not found in RMA");
  });
});
