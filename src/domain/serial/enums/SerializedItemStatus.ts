export enum SerializedItemStatus {
  Pending = "pending",
  InStock = "in_stock",
  Sold = "sold",
  Returned = "returned",
  Quarantined = "quarantined",
  Transferred = "transferred",
  Damaged = "damaged",
  WrittenOff = "written_off",
}

export function allowedTransitions(status: SerializedItemStatus): SerializedItemStatus[] {
  switch (status) {
    case SerializedItemStatus.Pending:
      return [
        SerializedItemStatus.InStock,
        SerializedItemStatus.Damaged,
        SerializedItemStatus.Quarantined,
      ];
    case SerializedItemStatus.InStock:
      return [
        SerializedItemStatus.Sold,
        SerializedItemStatus.Damaged,
        SerializedItemStatus.Quarantined,
        SerializedItemStatus.Transferred,
        SerializedItemStatus.WrittenOff,
      ];
    case SerializedItemStatus.Sold:
      return [SerializedItemStatus.Returned];
    case SerializedItemStatus.Returned:
      return [
        SerializedItemStatus.InStock,
        SerializedItemStatus.Damaged,
        SerializedItemStatus.WrittenOff,
        SerializedItemStatus.Quarantined,
      ];
    case SerializedItemStatus.Quarantined:
      return [
        SerializedItemStatus.InStock,
        SerializedItemStatus.Damaged,
        SerializedItemStatus.WrittenOff,
      ];
    case SerializedItemStatus.Transferred:
      return [
        SerializedItemStatus.InStock,
        SerializedItemStatus.Damaged,
      ];
    case SerializedItemStatus.Damaged:
      return [
        SerializedItemStatus.Quarantined,
        SerializedItemStatus.WrittenOff,
      ];
    case SerializedItemStatus.WrittenOff:
      return [];
    default:
      return [];
  }
}

export function canTransitionTo(from: SerializedItemStatus, to: SerializedItemStatus): boolean {
  return allowedTransitions(from).includes(to);
}

export function isCountedInStock(status: SerializedItemStatus): boolean {
  return status === SerializedItemStatus.InStock;
}

export function requiresLedgerEntry(from: SerializedItemStatus, to: SerializedItemStatus): boolean {
  const wasInStock = isCountedInStock(from);
  const nowInStock = isCountedInStock(to);
  return (wasInStock && !nowInStock) || (!wasInStock && nowInStock);
}
