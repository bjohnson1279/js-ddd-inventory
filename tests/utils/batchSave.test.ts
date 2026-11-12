import { batchSave, BatchSaveRepository } from "../../src/utils/batchSave";

describe("batchSave utility", () => {
  interface TestItem {
    id: string;
    name: string;
  }

  it("should do nothing when items array is empty", async () => {
    const saveMock = jest.fn();
    const saveManyMock = jest.fn();

    const repo: BatchSaveRepository<TestItem> = {
      save: saveMock,
      saveMany: saveManyMock,
    };

    await batchSave(repo, []);

    expect(saveMock).not.toHaveBeenCalled();
    expect(saveManyMock).not.toHaveBeenCalled();
  });

  it("should call saveMany when repository provides saveMany method", async () => {
    const saveMock = jest.fn();
    const saveManyMock = jest.fn().mockResolvedValue(undefined);

    const repo: BatchSaveRepository<TestItem> = {
      save: saveMock,
      saveMany: saveManyMock,
    };

    const items: TestItem[] = [
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
    ];

    await batchSave(repo, items);

    expect(saveManyMock).toHaveBeenCalledTimes(1);
    expect(saveManyMock).toHaveBeenCalledWith(items);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("should call save sequentially for each item when saveMany is not provided", async () => {
    const callOrder: string[] = [];
    const saveMock = jest.fn().mockImplementation(async (item: TestItem) => {
      callOrder.push(item.id);
    });

    const repo: BatchSaveRepository<TestItem> = {
      save: saveMock,
    };

    const items: TestItem[] = [
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
      { id: "3", name: "Item 3" },
    ];

    await batchSave(repo, items);

    expect(saveMock).toHaveBeenCalledTimes(3);
    expect(saveMock).toHaveBeenNthCalledWith(1, items[0]);
    expect(saveMock).toHaveBeenNthCalledWith(2, items[1]);
    expect(saveMock).toHaveBeenNthCalledWith(3, items[2]);
    expect(callOrder).toEqual(["1", "2", "3"]);
  });

  it("should fallback to save if saveMany property is not a function", async () => {
    const saveMock = jest.fn().mockResolvedValue(undefined);

    const repo = {
      save: saveMock,
      saveMany: undefined,
    } as unknown as BatchSaveRepository<TestItem>;

    const items: TestItem[] = [{ id: "1", name: "Item 1" }];

    await batchSave(repo, items);

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith(items[0]);
  });
});
