import { SerialNumber } from "../valueObjects/SerialNumber";
import { SerializedItemStatus } from "../enums/SerializedItemStatus";

export class InvalidSerialStatusTransitionException extends Error {
  constructor(
    public readonly serialNumber: SerialNumber,
    public readonly from: SerializedItemStatus,
    public readonly to: SerializedItemStatus
  ) {
    super(
      `Invalid status transition for serial ${serialNumber.value} from ${from} to ${to}.`
    );
    this.name = "InvalidSerialStatusTransitionException";
  }
}
