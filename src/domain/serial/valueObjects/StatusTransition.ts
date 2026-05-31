import { SerializedItemStatus } from "../enums/SerializedItemStatus";

export class StatusTransition {
  constructor(
    public readonly from: SerializedItemStatus,
    public readonly to: SerializedItemStatus,
    public readonly reason: string,
    public readonly actor: string,
    public readonly referenceId: string | null,
    public readonly occurredAt: Date
  ) {}
}
