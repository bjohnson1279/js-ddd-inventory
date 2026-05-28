import { DomainException } from "./DomainException";

export class InsufficientStockException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
