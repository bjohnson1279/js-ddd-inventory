import { VariantBarcodeSet } from "../../../src/domain/barcode/aggregates/VariantBarcodeSet";
import { Barcode } from "../../../src/domain/barcode/valueObjects/Barcode";
import { BarcodeSymbology } from "../../../src/domain/barcode/enums/BarcodeSymbology";
import { BarcodeSource } from "../../../src/domain/barcode/enums/BarcodeSource";
import { DuplicateBarcodeException } from "../../../src/domain/barcode/exceptions/DuplicateBarcodeException";

describe("VariantBarcodeSet Aggregate", () => {
  it("should initialize with empty assignments", () => {
    const set = new VariantBarcodeSet("VAR-1");
    expect(set.variantId).toBe("VAR-1");
    expect(set.all().length).toBe(0);
    expect(set.primaryBarcode()).toBeNull();
  });

  it("should assign first barcode as primary automatically", () => {
    const set = new VariantBarcodeSet("VAR-1");
    const barcode = new Barcode(BarcodeSymbology.UPC_A, "012345678905");
    const assignment = set.assign(barcode, BarcodeSource.Supplier);

    expect(set.all().length).toBe(1);
    expect(assignment.isPrimary).toBe(true);
    expect(set.primaryBarcode()?.id).toBe(assignment.id);
  });

  it("should assign subsequent barcodes as non-primary by default", () => {
    const set = new VariantBarcodeSet("VAR-1");
    const upc = new Barcode(BarcodeSymbology.UPC_A, "012345678905");
    const internal = new Barcode(BarcodeSymbology.CODE_128, "INV-1");

    const assign1 = set.assign(upc, BarcodeSource.Supplier);
    const assign2 = set.assign(internal, BarcodeSource.Internal);

    expect(set.all().length).toBe(2);
    expect(assign1.isPrimary).toBe(true);
    expect(assign2.isPrimary).toBe(false);
  });

  it("should demote existing primary when new primary is assigned", () => {
    const set = new VariantBarcodeSet("VAR-1");
    const upc = new Barcode(BarcodeSymbology.UPC_A, "012345678905");
    const internal = new Barcode(BarcodeSymbology.CODE_128, "INV-1");

    const assign1 = set.assign(upc, BarcodeSource.Supplier);
    const assign2 = set.assign(internal, BarcodeSource.Internal, true);

    expect(set.all().length).toBe(2);
    expect(set.primaryBarcode()?.id).toBe(assign2.id);

    const freshAssign1 = set.all().find((a) => a.id === assign1.id);
    expect(freshAssign1?.isPrimary).toBe(false);
  });

  it("should throw DuplicateBarcodeException for duplicate assignment values", () => {
    const set = new VariantBarcodeSet("VAR-1");
    const upc1 = new Barcode(BarcodeSymbology.UPC_A, "012345678905");
    const upc2 = new Barcode(BarcodeSymbology.UPC_A, "012345678905");

    set.assign(upc1, BarcodeSource.Supplier);
    expect(() => set.assign(upc2, BarcodeSource.GS1)).toThrow(DuplicateBarcodeException);
  });

  it("should throw DuplicateBarcodeException when assigning the exact same barcode instance twice", () => {
    const set = new VariantBarcodeSet("VAR-1");
    const upc = new Barcode(BarcodeSymbology.UPC_A, "012345678905");

    set.assign(upc, BarcodeSource.Supplier);
    expect(() => set.assign(upc, BarcodeSource.Supplier)).toThrow(DuplicateBarcodeException);
  });

  it("should throw an error when revoking a non-existent assignment", () => {
    const set = new VariantBarcodeSet("VAR-1");

    expect(() => set.revoke("non-existent-id")).toThrow("Assignment non-existent-id not found.");
  });

  it("should revoke assignments and release domain events", () => {
    const set = new VariantBarcodeSet("VAR-1");
    const upc = new Barcode(BarcodeSymbology.UPC_A, "012345678905");
    const assignment = set.assign(upc, BarcodeSource.Supplier);

    expect(set.releaseEvents()).toContainEqual({
      type: "BarcodeAssigned",
      variantId: "VAR-1",
      barcode: "012345678905",
    });

    set.revoke(assignment.id);
    expect(set.all().length).toBe(0);

    expect(set.releaseEvents()).toContainEqual({
      type: "BarcodeRevoked",
      variantId: "VAR-1",
      barcode: "012345678905",
    });
  });

  it("should block revoking primary barcode if other assignments exist", () => {
    const set = new VariantBarcodeSet("VAR-1");
    const upc = new Barcode(BarcodeSymbology.UPC_A, "012345678905");
    const internal = new Barcode(BarcodeSymbology.CODE_128, "INV-1");

    const assign1 = set.assign(upc, BarcodeSource.Supplier);
    set.assign(internal, BarcodeSource.Internal);

    expect(() => set.revoke(assign1.id)).toThrow(/Cannot revoke the primary barcode/);
  });
});
