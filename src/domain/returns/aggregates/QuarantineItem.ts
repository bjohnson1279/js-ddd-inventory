import { AggregateRoot } from "../../aggregates/AggregateRoot";
import { QuarantineStatus } from "../enums/QuarantineStatus";

export class QuarantineItem extends AggregateRoot {
  private _status: QuarantineStatus;
  private _resolvedAt: Date | null;

  constructor(
    public readonly id: string,
    public readonly variantId: string,
    public readonly quantity: number,
    public readonly reason: string,
    public readonly locationId: string,
    public readonly tenantId: string,
    status: QuarantineStatus = QuarantineStatus.Quarantined,
    public readonly createdAt: Date = new Date(),
    resolvedAt: Date | null = null
  ) {
    super();
    if (quantity <= 0 || isNaN(quantity)) {
      throw new Error("Quantity must be greater than zero.");
    }
    this._status = status;
    this._resolvedAt = resolvedAt;
  }

  public get status(): QuarantineStatus {
    return this._status;
  }

  public get resolvedAt(): Date | null {
    return this._resolvedAt;
  }

  public release(): void {
    this.resolveRestock();
  }

  public scrap(): void {
    this.resolveScrap();
  }

  public resolveRestock(): void {
    if (this._status !== QuarantineStatus.Quarantined) {
      throw new Error("Quarantine item is already resolved.");
    }
    this._status = QuarantineStatus.Restocked;
    this._resolvedAt = new Date();
  }

  public resolveScrap(): void {
    if (this._status !== QuarantineStatus.Quarantined) {
      throw new Error("Quarantine item is already resolved.");
    }
    this._status = QuarantineStatus.Scrapped;
    this._resolvedAt = new Date();
  }

  public resolveRtv(): void {
    if (this._status !== QuarantineStatus.Quarantined) {
      throw new Error("Quarantine item is already resolved.");
    }
    this._status = QuarantineStatus.Rtv;
    this._resolvedAt = new Date();
  }
}
