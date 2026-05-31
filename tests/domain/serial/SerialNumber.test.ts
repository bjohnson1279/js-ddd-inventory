import { SerialNumber } from "../../../src/domain/serial/valueObjects/SerialNumber";

describe("SerialNumber Value Object", () => {
  it("should create valid serials and normalize them", () => {
    const sn = new SerialNumber("  sn-abc-123.45/xy  ");
    expect(sn.value).toBe("SN-ABC-123.45/XY");
  });

  it("should throw error for empty serials", () => {
    expect(() => new SerialNumber("")).toThrow(/empty/i);
    expect(() => new SerialNumber("   ")).toThrow(/empty/i);
  });

  it("should throw error if serial exceeds 100 characters", () => {
    const longStr = "A".repeat(101);
    expect(() => new SerialNumber(longStr)).toThrow(/exceed 100/i);
  });

  it("should throw error for invalid characters", () => {
    expect(() => new SerialNumber("SN#123")).toThrow(/invalid characters/i);
    expect(() => new SerialNumber("SN_123")).toThrow(/invalid characters/i);
  });

  it("should check equality", () => {
    const sn1 = new SerialNumber("SN-1");
    const sn2 = new SerialNumber("sn-1");
    const sn3 = new SerialNumber("SN-2");

    expect(sn1.equals(sn2)).toBe(true);
    expect(sn1.equals(sn3)).toBe(false);
  });
});
