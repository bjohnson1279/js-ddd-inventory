import { prisma } from "../../infrastructure/database/prisma";
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { ITenantConfigRepository } from "../../domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../domain/repositories/IJournalRepository";
import { CostLayerService } from "../../domain/accounting/services/CostLayerService";
import { AccountingJournalService } from "../../domain/accounting/services/AccountingJournalService";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import { InventoryCostLayer } from "../../domain/accounting/entities/InventoryCostLayer";
import { AccountingMethod } from "../../domain/accounting/enums/AccountingMethod";
import crypto from "crypto";

export interface AssembleKitDTO {
  tenantId: string;
  locationId: string;
  kitSku: string;
  quantity: number;
  actorId: string;
  referenceId: string;
}

export class AssembleKit {
  private readonly costLayerService: CostLayerService;
  private readonly journalService: AccountingJournalService;

  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly costLayerRepository: ICostLayerRepository,
    private readonly tenantConfigRepository: ITenantConfigRepository,
    private readonly journalRepository: IJournalRepository
  ) {
    this.costLayerService = new CostLayerService(costLayerRepository);
    this.journalService = new AccountingJournalService(journalRepository, this.costLayerService);
  }

  async execute(dto: AssembleKitDTO): Promise<void> {
    const { tenantId, locationId, kitSku, quantity, actorId, referenceId } = dto;

    if (quantity <= 0) {
      throw new Error("Quantity to assemble must be greater than zero.");
    }

    // 1. Resolve kit details from prisma
    const kitRecord = await prisma.kitModel.findUnique({
      where: { sku: kitSku },
      include: { components: true }
    });
    if (!kitRecord) {
      throw new Error(`Kit with SKU ${kitSku} not found.`);
    }

    // 2. First pass: Validate component stock level (Optimized N+1 lookup)
    const skusToFetch = kitRecord.components.map(comp => SKU.create(comp.variantId));
    let inventoryItems: InventoryItem[] = [];
    if (this.inventoryRepository.findBySkus && skusToFetch.length > 0) {
      inventoryItems = await this.inventoryRepository.findBySkus(skusToFetch, locationId);
    } else if (skusToFetch.length > 0) {
      const results = await Promise.all(skusToFetch.map(sku => this.inventoryRepository.findBySku(sku, locationId)));
      inventoryItems = results.filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined);
    }
    const inventoryItemsMap = new Map(inventoryItems.map(i => [i.sku.getValue(), i]));

    const componentItems = kitRecord.components.map((comp) => {
      const invItem = inventoryItemsMap.get(comp.variantId);
      const needed = comp.quantity * quantity;
      const available = invItem ? invItem.quantity.getValue() : 0;
      if (available < needed) {
        throw new Error(`Insufficient stock for component variant ID ${comp.variantId}. Needed: ${needed}, Available: ${available}`);
      }
      return { invItem: invItem!, needed };
    });

    // 3. Second pass: Consume FIFO costing layers for components and calculate total components cost
    const componentsBatch = kitRecord.components.map(comp => ({
      variantId: comp.variantId,
      quantity: comp.quantity * quantity
    }));

    let totalCostCents = 0;
    if (componentsBatch.length > 0) {
      const breakdowns = await this.costLayerService.consumeFifoLayersBatch(componentsBatch);
      totalCostCents = breakdowns.reduce((sum, b) => sum + b.totalCostCents, 0);
    }

    // 4. Deduct stock for component variants
    const itemsToSave: InventoryItem[] = [];
    for (const { invItem, needed } of componentItems) {
      invItem.dispatchStock(Quantity.create(needed));
      itemsToSave.push(invItem);
    }

    if ('saveMany' in this.inventoryRepository && typeof (this.inventoryRepository as any).saveMany === 'function') {
      await (this.inventoryRepository as any).saveMany(itemsToSave);
    } else {
      await Promise.all(itemsToSave.map(item => this.inventoryRepository.save(item)));
    }

    // 5. Calculate assembled unit cost
    const unitCostCents = Math.round(totalCostCents / quantity);

    // 6. Create new costing layer for the assembled Kit variant
    const kitLayer = new InventoryCostLayer(
      crypto.randomUUID(),
      kitSku,
      tenantId,
      quantity,
      unitCostCents,
      new Date(),
      referenceId,
      locationId
    );
    await this.costLayerRepository.save(kitLayer);

    // 7. Add stock for the Kit variant
    let kitInvItem = await this.inventoryRepository.findBySku(SKU.create(kitSku), locationId);
    if (!kitInvItem) {
      kitInvItem = InventoryItem.create(
        crypto.randomUUID(),
        SKU.create(kitSku),
        locationId,
        Quantity.create(0)
      );
    }
    kitInvItem.receiveStock(Quantity.create(quantity));
    await this.inventoryRepository.save(kitInvItem);

    // 8. Write balanced journal entry if Accrual
    const config = await this.tenantConfigRepository.findByTenantId(tenantId);
    if (config && config.accountingMethod === AccountingMethod.Accrual) {
      await this.journalService.onKitAssembly(
        tenantId,
        new Date(),
        `Assemble ${quantity} units of Kit ${kitSku}`,
        referenceId,
        kitSku,
        totalCostCents
      );
    }
  }
}
