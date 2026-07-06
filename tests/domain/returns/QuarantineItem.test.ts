import { QuarantineItem } from "../../../src/domain/returns/aggregates/QuarantineItem";
import { QuarantineStatus } from "../../../src/domain/returns/enums/QuarantineStatus";

describe("QuarantineItem Aggregate", () => {
  it("should initialize in QUARANTINED status", () => {
    const item = new QuarantineItem("q-1", "VAR-1", 5, "Damaged packaging", "loc-1", "TEN-1");

    expect(item.status).toBe(QuarantineStatus.Quarantined);
    expect(item.resolvedAt).toBeNull();
  });

  it("should resolve to Restocked", () => {
    const item = new QuarantineItem("q-1", "VAR-1", 5, "Damaged packaging", "loc-1", "TEN-1");
    item.resolveRestock();

    expect(item.status).toBe(QuarantineStatus.Restocked);
    expect(item.resolvedAt).not.toBeNull();
  });

  it("should resolve to Scrapped", () => {
    const item = new QuarantineItem("q-1", "VAR-1", 5, "Damaged packaging", "loc-1", "TEN-1");
    item.resolveScrap();

    expect(item.status).toBe(QuarantineStatus.Scrapped);
    expect(item.resolvedAt).not.toBeNull();
  });

  it("should resolve to Rtv", () => {
    const item = new QuarantineItem("q-1", "VAR-1", 5, "Damaged packaging", "loc-1", "TEN-1");
    item.resolveRtv();

    expect(item.status).toBe(QuarantineStatus.Rtv);
    expect(item.resolvedAt).not.toBeNull();
  });

  it("should throw if initialized with an invalid quantity", () => {
    expect(() => new QuarantineItem("q-1", "VAR-1", 0, "Damaged packaging", "loc-1", "TEN-1")).toThrow(/Quantity must be greater than zero./i);
    expect(() => new QuarantineItem("q-1", "VAR-1", -5, "Damaged packaging", "loc-1", "TEN-1")).toThrow(/Quantity must be greater than zero./i);
    expect(() => new QuarantineItem("q-1", "VAR-1", NaN, "Damaged packaging", "loc-1", "TEN-1")).toThrow(/Quantity must be greater than zero./i);
  });

  it("should throw if trying to resolve an already resolved item via resolveScrap", () => {
    const item = new QuarantineItem("q-1", "VAR-1", 5, "Damaged packaging", "loc-1", "TEN-1");
    item.resolveRestock();

    expect(() => item.resolveScrap()).toThrow(/already resolved/i);
  });

  it("should throw if trying to resolve an already resolved item via resolveRestock", () => {
    const item = new QuarantineItem("q-1", "VAR-1", 5, "Damaged packaging", "loc-1", "TEN-1");
    item.resolveScrap();

    expect(() => item.resolveRestock()).toThrow(/already resolved/i);
  });

  it("should throw if trying to resolve an already resolved item via resolveRtv", () => {
    const item = new QuarantineItem("q-1", "VAR-1", 5, "Damaged packaging", "loc-1", "TEN-1");
    item.resolveScrap();

    expect(() => item.resolveRtv()).toThrow(/already resolved/i);
  });
});
