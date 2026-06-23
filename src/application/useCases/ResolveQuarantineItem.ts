import { IQuarantineRepository } from "../../domain/repositories/IQuarantineRepository";
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { ITenantConfigRepository } from "../../domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../domain/repositories/IJournalRepository";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import { CostLayerService } from "../../domain/accounting/services/CostLayerService";
import { AccountingJournalService } from "../../domain/accounting/services/AccountingJournalService";
import { AccountingMethod } from "../../domain/accounting/enums/AccountingMethod";

export interface ResolveQuarantineItemDTO {
  quarantineItemId: string;
  resolution: "RESTOCK" | "SCRAP" | "RTV";
}

export class ResolveQuarantineItem {
  private readonly costLayerService: CostLayerService;
  private readonly journalService: AccountingJournalService;

  constructor(
    private readonly quarantineRepository: IQuarantineRepository,
    private readonly inventoryRepository: IInventoryRepository,
    private readonly costLayerRepository: ICostLayerRepository,
    private readonly tenantConfigRepository: ITenantConfigRepository,
    private readonly journalRepository: IJournalRepository
  ) {
    this.costLayerService = new CostLayerService(costLayerRepository);
    this.journalService = new AccountingJournalService(journalRepository, this.costLayerService);
  }

  async execute(dto: ResolveQuarantineItemDTO): Promise<void> {
    const qItem = await this.quarantineRepository.findById(dto.quarantineItemId);
    if (!qItem) {
      throw new Error(`Quarantine item with ID ${dto.quarantineItemId} not found.`);
    }

    const config = await this.tenantConfigRepository.findByTenantId(qItem.tenantId);
    if (!config) {
      throw new Error(`Tenant config not found for tenant ${qItem.tenantId}.`);
    }

    const sku = SKU.create(qItem.variantId);
    const quarantineLocId = `${qItem.locationId}-quarantine`;

    // 1. Decrement stock from Quarantine location
    const invQuarantineItem = await this.inventoryRepository.findBySku(sku, quarantineLocId);
    if (!invQuarantineItem) {
      throw new Error(`Quarantine stock not found for variant ${qItem.variantId} at ${quarantineLocId}.`);
    }
    invQuarantineItem.dispatchStock(Quantity.create(qItem.quantity));
    await this.inventoryRepository.save(invQuarantineItem);

    // Helper to consume layers only at the quarantine location
    const consumeQuarantineLayers = async (qty: number): Promise<number> => {
      const activeLayers = await this.costLayerRepository.getActiveLayers(qItem.variantId, "asc");
      const qLayers = activeLayers.filter((l) => l.locationId === quarantineLocId);

      let remaining = qty;
      let costCents = 0;

      for (const layer of qLayers) {
        if (remaining <= 0) break;
        const consumed = layer.consume(remaining);
        costCents += consumed * layer.unitCostCents;
        remaining -= consumed;
      }

      if (remaining > 0) {
        throw new Error(
          `Insufficient active layers in quarantine for variant ${qItem.variantId} at location ${quarantineLocId}.`
        );
      }

      if (this.costLayerRepository.saveMany) {
        await this.costLayerRepository.saveMany(qLayers);
      } else {
        await Promise.all(qLayers.map((l) => this.costLayerRepository.save(l)));
      }

      return costCents;
    };

    if (dto.resolution === "RESTOCK") {
      qItem.resolveRestock();

      // Increment sellable stock
      let invItem = await this.inventoryRepository.findBySku(sku, qItem.locationId);
      if (!invItem) {
        invItem = InventoryItem.create(
          crypto.randomUUID(),
          sku,
          qItem.locationId,
          Quantity.create(0)
        );
      }
      invItem.receiveStock(Quantity.create(qItem.quantity));
      await this.inventoryRepository.save(invItem);

      // Move cost layers from quarantine to standard location
      const activeLayers = await this.costLayerRepository.getActiveLayers(qItem.variantId);
      const qLayers = activeLayers.filter((l) => l.locationId === quarantineLocId);

      let remainingToMove = qItem.quantity;
      for (const layer of qLayers) {
        if (remainingToMove <= 0) break;
        const toMove = Math.min(remainingToMove, layer.remainingQuantity);
        (layer as any).locationId = qItem.locationId; // Reassign layer location
        remainingToMove -= toMove;
      }

      if (this.costLayerRepository.saveMany) {
        await this.costLayerRepository.saveMany(qLayers);
      } else {
        await Promise.all(qLayers.map((l) => this.costLayerRepository.save(l)));
      }
    } else if (dto.resolution === "SCRAP") {
      qItem.resolveScrap();

      // Consume cost layers and compute value
      const totalCostCents = await consumeQuarantineLayers(qItem.quantity);

      // Post write-off journal if Accrual
      if (config.accountingMethod === AccountingMethod.Accrual) {
        await this.journalService.onInventoryWriteOff(
          qItem.id,
          totalCostCents,
          new Date(),
          config,
          qItem.tenantId
        );
      }
    } else if (dto.resolution === "RTV") {
      qItem.resolveRtv();

      // Consume cost layers and compute value
      const totalCostCents = await consumeQuarantineLayers(qItem.quantity);

      // Post Return to Vendor journal if Accrual
      if (config.accountingMethod === AccountingMethod.Accrual) {
        await this.journalService.onReturnToVendor(
          qItem.id,
          totalCostCents,
          new Date(),
          config,
          qItem.tenantId
        );
      }
    }

    await this.quarantineRepository.save(qItem);
  }
}
