import { DomainException } from "./DomainException";

export class CapacityExceededException extends DomainException {
  constructor(
    public readonly locationId: string,
    public readonly limitType: "weight" | "volume",
    public readonly limit: number,
    public readonly prospective: number
  ) {
    super(
      `Capacity exceeded at location ${locationId}: ${limitType} limit is ${limit}, but prospective ${limitType} is ${prospective}.`
    );
  }
}
