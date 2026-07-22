import { BarcodeAssignment } from "../../../../src/domain/barcode/entities/BarcodeAssignment";
import { Barcode } from "../../../../src/domain/barcode/valueObjects/Barcode";
import { BarcodeSource } from "../../../../src/domain/barcode/enums/BarcodeSource";
import { BarcodeSymbology } from "../../../../src/domain/barcode/enums/BarcodeSymbology";

describe("BarcodeAssignment", () => {
  it("should correctly assign properties via constructor", () => {
    // Arrange
    const id = "assignment-123";
    const variantId = "variant-456";
    const rawBarcodeValue = "123456789012";
    const barcode = new Barcode(BarcodeSymbology.UPC_A, rawBarcodeValue);
    const source = BarcodeSource.Internal;
    const isPrimary = true;
    const assignedAt = new Date("2023-01-01T10:00:00Z");

    // Act
    const assignment = new BarcodeAssignment(
      id,
      variantId,
      barcode,
      source,
      isPrimary,
      assignedAt
    );

    // Assert
    expect(assignment.id).toBe(id);
    expect(assignment.variantId).toBe(variantId);
    expect(assignment.barcode).toBe(barcode);
    expect(assignment.source).toBe(source);
    expect(assignment.isPrimary).toBe(isPrimary);
    expect(assignment.assignedAt).toBe(assignedAt);
  });
});
