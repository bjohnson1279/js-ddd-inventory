import { DomainException } from "./DomainException";

export class InvalidQuantityException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
