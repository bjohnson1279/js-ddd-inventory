import { RMAItemStatus } from "../enums/RMAItemStatus";
import { RMADisposition } from "../enums/RMADisposition";

export class RMAItem {
  private _receivedQuantity: number;
  private _status: RMAItemStatus;
  private _disposition: RMADisposition | null;

  constructor(
    public readonly id: string,
    public readonly variantId: string,
    public readonly quantity: number,
    public readonly unitCostCents: number,
    receivedQuantity: number = 0,
    status: RMAItemStatus = RMAItemStatus.Pending,
    disposition: RMADisposition | null = null
  ) {
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }
    if (unitCostCents < 0) {
      throw new Error("Unit cost cannot be negative.");
    }
    if (receivedQuantity < 0) {
      throw new Error("Received quantity cannot be negative.");
    }
    this._receivedQuantity = receivedQuantity;
    this._status = status;
    this._disposition = disposition;
  }

  public get receivedQuantity(): number {
    return this._receivedQuantity;
  }

  public get status(): RMAItemStatus {
    return this._status;
  }

  public get disposition(): RMADisposition | null {
    return this._disposition;
  }

  public receive(amount: number, disposition: RMADisposition): void {
    if (amount <= 0) {
      throw new Error("Receive quantity must be greater than zero.");
    }
    if (this._receivedQuantity + amount > this.quantity) {
      throw new Error(
        `Cannot receive ${amount} units. Total received would exceed expected quantity of ${this.quantity}.`
      );
    }
    this._receivedQuantity += amount;
    this._disposition = disposition;
    
    if (this._receivedQuantity === this.quantity) {
      this._status = RMAItemStatus.Received;
    } else {
      this._status = RMAItemStatus.Pending; // Partially received
    }
  }

  public reject(): void {
    this._status = RMAItemStatus.Rejected;
  }

  public isFullyProcessed(): boolean {
    return this._status === RMAItemStatus.Received || this._status === RMAItemStatus.Rejected;
  }
}
