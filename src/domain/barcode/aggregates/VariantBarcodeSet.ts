import { BarcodeAssignment } from "../entities/BarcodeAssignment";
import { Barcode } from "../valueObjects/Barcode";
import { BarcodeSource } from "../enums/BarcodeSource";
import { DuplicateBarcodeException } from "../exceptions/DuplicateBarcodeException";

export class VariantBarcodeSet {
  private assignments: Map<string, BarcodeAssignment> = new Map();
  private domainEvents: any[] = [];

  constructor(public readonly variantId: string) {}

  public assign(
    barcode: Barcode,
    source: BarcodeSource,
    makePrimary: boolean = false
  ): BarcodeAssignment {
    // Guard: no duplicate barcode values within this set
    for (const existing of this.assignments.values()) {
      if (existing.barcode.equals(barcode)) {
        throw new DuplicateBarcodeException(
          `Barcode ${barcode.value} is already assigned to this variant.`
        );
      }
    }

    // If makePrimary, demote any existing primary
    if (makePrimary) {
      for (const [id, a] of this.assignments.entries()) {
        if (a.isPrimary) {
          this.assignments.set(id, this.cloneWithPrimary(a, false));
        }
      }
    }

    // If this is the first assignment, make it primary automatically
    const shouldBePrimary = makePrimary || this.assignments.size === 0;

    const assignment = new BarcodeAssignment(
      crypto.randomUUID(), // Simple ID generator
      this.variantId,
      barcode,
      source,
      shouldBePrimary,
      new Date()
    );

    this.assignments.set(assignment.id, assignment);

    this.domainEvents.push({
      type: "BarcodeAssigned",
      variantId: this.variantId,
      barcode: barcode.value,
    });

    return assignment;
  }

  public revoke(assignmentId: string): void {
    const assignment = this.assignments.get(assignmentId);

    if (!assignment) {
      throw new Error(`Assignment ${assignmentId} not found.`);
    }

    if (assignment.isPrimary && this.assignments.size > 1) {
      throw new Error(
        "Cannot revoke the primary barcode while other assignments exist. Promote another barcode to primary first."
      );
    }

    this.assignments.delete(assignmentId);

    this.domainEvents.push({
      type: "BarcodeRevoked",
      variantId: this.variantId,
      barcode: assignment.barcode.value,
    });
  }

  public primaryBarcode(): BarcodeAssignment | null {
    for (const assignment of this.assignments.values()) {
      if (assignment.isPrimary) {
        return assignment;
      }
    }
    return null;
  }

  public all(): BarcodeAssignment[] {
    return Array.from(this.assignments.values());
  }

  public releaseEvents(): any[] {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    return events;
  }

  private cloneWithPrimary(a: BarcodeAssignment, isPrimary: boolean): BarcodeAssignment {
    return new BarcodeAssignment(
      a.id,
      a.variantId,
      a.barcode,
      a.source,
      isPrimary,
      a.assignedAt
    );
  }
}
