import { IRMARepository } from "../../domain/repositories/IRMARepository";

export class AuthorizeRMA {
  constructor(private readonly rmaRepository: IRMARepository) {}

  async execute(rmaId: string): Promise<void> {
    const rma = await this.rmaRepository.findById(rmaId);
    if (!rma) {
      throw new Error(`RMA with ID ${rmaId} not found.`);
    }

    rma.authorize();
    await this.rmaRepository.save(rma);
  }
}
