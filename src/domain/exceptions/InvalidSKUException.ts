import { DomainException } from "./DomainException";

export class InvalidSKUException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
