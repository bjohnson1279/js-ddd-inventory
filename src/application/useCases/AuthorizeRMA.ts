import { IRMARepository } from "../../domain/repositories/IRMARepository";

export class AuthorizeRMA {
  constructor(private readonly rmaRepository: IRMARepository) {}

  async execute(rmaId: string): Promise<void> {
    if (!rmaId || rmaId.trim() === "") {
      throw new Error("RMA ID cannot be empty.");
    }
    const rma = await this.rmaRepository.findById(rmaId);
    if (!rma) {
      throw new Error(`RMA with ID ${rmaId} not found.`);
    }

    rma.authorize();
    await this.rmaRepository.save(rma);
  }
}
