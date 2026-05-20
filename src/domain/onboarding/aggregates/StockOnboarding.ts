import { StockOnboardingStatus } from "../enums/StockOnboardingStatus";
import { StockOnboardingItem } from "../valueObjects/StockOnboardingItem";

export class StockOnboarding {
  private status: StockOnboardingStatus;
  private items: Map<string, StockOnboardingItem> = new Map();
  private domainEvents: any[] = [];

  constructor(
    public readonly id: string,
    public readonly locationId: string,
    public readonly asOfDate: Date
  ) {
    this.status = StockOnboardingStatus.Draft;
  }

  // -------------------------------------------------------------------------
  // Mutations — only allowed while in Draft
  // -------------------------------------------------------------------------

  /**
   * Set or replace a variant's opening quantity and cost.
   * Calling this again for the same variant overwrites the previous entry,
   * allowing corrections before submission.
   */
  public setItem(
    variantId: string,
    quantity: number,
    unitCostCents: number
  ): void {
    this.assertDraft();

    this.items.set(
      variantId,
      new StockOnboardingItem(variantId, quantity, unitCostCents)
    );
  }

  /**
   * Remove a variant from the onboarding before submission.
   */
  public removeItem(variantId: string): void {
    this.assertDraft();
    this.items.delete(variantId);
  }

  /**
   * Lock the onboarding. After submission, items cannot be changed.
   * This raises a domain event that the OpeningBalanceService listens to.
   */
  public submit(): void {
    this.assertDraft();

    if (this.items.size === 0) {
      throw new Error("Cannot submit a stock onboarding with no items.");
    }

    this.status = StockOnboardingStatus.Submitted;

    this.domainEvents.push({
      type: "StockOnboardingSubmitted",
      onboardingId: this.id,
      locationId: this.locationId,
    });
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  public getStatus(): StockOnboardingStatus {
    return this.status;
  }

  public isSubmitted(): boolean {
    return this.status === StockOnboardingStatus.Submitted;
  }

  public getItems(): StockOnboardingItem[] {
    return Array.from(this.items.values());
  }

  public releaseEvents(): any[] {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    return events;
  }

  // -------------------------------------------------------------------------
  // Invariant guard
  // -------------------------------------------------------------------------

  private assertDraft(): void {
    if (this.status !== StockOnboardingStatus.Draft) {
      throw new Error(
        `Onboarding ${this.id} has been submitted and is immutable.`
      );
    }
  }
}
