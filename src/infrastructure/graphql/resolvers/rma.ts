export class RMAResolver {
  private rmaRepo: any;

  constructor(rmaRepo: any) {
    this.rmaRepo = rmaRepo;
  }

  async getRMA(rmaNumber: string): Promise<any> {
    return await this.rmaRepo.get(rmaNumber);
  }

  async updateRMAMapping(rmaNumber: any, warehouseId: any): Promise<void> {
    const rma = await this.rmaRepo.get(rmaNumber);
    if (!rma) throw new Error("RMA not found");
    for (const item of rma.items) {
      await this.rmaRepo.updateMapping(item.id, warehouseId);
    }
  }

  async processDisposition(rmaId: any, itemId: any, disposition: any): Promise<void> {
    const rma = await this.rmaRepo.get(rmaId);
    if (!rma) throw new Error("RMA not found");
    for (const item of rma.items) {
      if (item.id === itemId) {
        await this.rmaRepo.processDisposition(item.variantId, { disposition });
        return;
      }
    }
    throw new Error("Item not found in RMA");
  }

  async trackInspectionNotes(rmaNumber: any, itemId: any, notes: any): Promise<void> {
    const rma = await this.rmaRepo.get(rmaNumber);
    if (!rma) throw new Error("RMA not found");
    for (const item of rma.items) {
      if (item.id === itemId) {
        await this.rmaRepo.trackInspectionNotes(rmaNumber, { itemId, notes });
        return;
      }
    }
    throw new Error("Item not found in RMA");
  }
}
