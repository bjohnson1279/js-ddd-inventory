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

export interface DisassembleKitDTO {
  tenantId: string;
  locationId: string;
  kitSku: string;
  quantity: number;
  actorId: string;
  referenceId: string;
}

export class DisassembleKit {
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

  async execute(dto: DisassembleKitDTO): Promise<void> {
    const { tenantId, locationId, kitSku, quantity, actorId, referenceId } = dto;

    if (quantity <= 0) {
      throw new Error("Quantity to disassemble must be greater than zero.");
    }

    // 1. Resolve kit details from prisma
    const kitRecord = await prisma.kitModel.findUnique({
      where: { sku: kitSku },
      include: { components: true }
    });
    if (!kitRecord) {
      throw new Error(`Kit with SKU ${kitSku} not found.`);
    }

    // 2. First pass: Validate kit stock level
    const kitSkuObj = SKU.create(kitSku);
    const kitInvItem = await this.inventoryRepository.findBySku(kitSkuObj, locationId);
    const availableKit = kitInvItem ? kitInvItem.quantity.getValue() : 0;
    if (availableKit < quantity) {
      throw new Error(`Insufficient stock for Kit variant ${kitSku}. Needed: ${quantity}, Available: ${availableKit}`);
    }

    // 3. Consume FIFO costing layers for the kit
    const kitBreakdown = await this.costLayerService.consumeFifoLayers(kitSku, quantity);
    const totalDisassembledCost = kitBreakdown.totalCostCents;

    // 4. Deduct kit stock
    kitInvItem!.dispatchStock(Quantity.create(quantity));
    await this.inventoryRepository.save(kitInvItem!);

    // 5. Estimate components value and distribute cost proportionally
    let totalEstimatedComponentsCost = 0;
    const componentAvgCosts: { variantId: string; quantity: number; avgUnitCost: number }[] = [];

    const componentEstimates = await Promise.all(kitRecord.components.map(async (component) => {
      const needed = component.quantity * quantity;
      let avgUnitCost = 0;

      try {
        const activeLayers = await this.costLayerRepository.getActiveLayers(component.variantId, "asc");
        let totalUnits = 0;
        let totalValue = 0;
        for (const layer of activeLayers) {
          totalUnits += layer.remainingQuantity;
          totalValue += layer.remainingQuantity * layer.unitCostCents;
        }
        if (totalUnits > 0) {
          avgUnitCost = Math.round(totalValue / totalUnits);
        } else {
          avgUnitCost = activeLayers.length > 0 ? activeLayers[0].unitCostCents : 1000; // default 10.00
        }
      } catch (err) {
        avgUnitCost = 1000; // default 10.00
      }

      return {
        variantId: component.variantId,
        quantity: needed,
        avgUnitCost
      };
    }));

    for (const item of componentEstimates) {
      componentAvgCosts.push(item);
      totalEstimatedComponentsCost += item.quantity * item.avgUnitCost;
    }

    const scaleFactor = totalEstimatedComponentsCost > 0 ? totalDisassembledCost / totalEstimatedComponentsCost : 0;

    // 6. Restore component variants stock and costing layers
    const restoreLayers: InventoryCostLayer[] = [];
    const itemsToSave: InventoryItem[] = [];

    // First fetch all required component inventory items to avoid N+1 queries during update
    // We handle possible race conditions on identical component SKUs by accumulating updates
    // on a single retrieved instance.
    const skusToFetch = componentAvgCosts.map(item => SKU.create(item.variantId));
    let inventoryItems: InventoryItem[] = [];
    if ('findBySkus' in this.inventoryRepository && typeof (this.inventoryRepository as any).findBySkus === 'function') {
      inventoryItems = await (this.inventoryRepository as any).findBySkus(skusToFetch, locationId);
    } else {
      const results = await Promise.all(skusToFetch.map(sku => this.inventoryRepository.findBySku(sku, locationId)));
      inventoryItems = results.filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined);
    }
    const inventoryItemsMap = new Map(
      inventoryItems.filter((i): i is InventoryItem => i !== null).map(i => [i.sku.getValue(), i])
    );

    // Prepare components updates
    for (const item of componentAvgCosts) {
      const allocatedUnitCost = scaleFactor > 0 ? Math.round(item.avgUnitCost * scaleFactor) : 0;

      // Add new costing layer for restored component
      const layer = new InventoryCostLayer(
        crypto.randomUUID(),
        item.variantId,
        tenantId,
        item.quantity,
        allocatedUnitCost,
        new Date(),
        referenceId,
        locationId
      );
      restoreLayers.push(layer);

      // Increment stock level for this component
      const skuStr = item.variantId;
      let compInv = inventoryItemsMap.get(skuStr);
      if (!compInv) {
        compInv = InventoryItem.create(
          crypto.randomUUID(),
          SKU.create(skuStr),
          locationId,
          Quantity.create(0)
        );
        inventoryItemsMap.set(skuStr, compInv);
        itemsToSave.push(compInv);
      } else if (!itemsToSave.includes(compInv)) {
        itemsToSave.push(compInv);
      }

      compInv.receiveStock(Quantity.create(item.quantity));
    }

    // Batch save inventory items if possible, otherwise Promise.all
    if ('saveMany' in this.inventoryRepository && typeof (this.inventoryRepository as any).saveMany === 'function') {
      await (this.inventoryRepository as any).saveMany(itemsToSave);
    } else {
      await Promise.all(itemsToSave.map(item => this.inventoryRepository.save(item)));
    }

    // Batch save cost layers if possible, otherwise Promise.all
    if ('saveMany' in this.costLayerRepository && typeof (this.costLayerRepository as any).saveMany === 'function') {
      await (this.costLayerRepository as any).saveMany(restoreLayers);
    } else {
      await Promise.all(restoreLayers.map(l => this.costLayerRepository.save(l)));
    }

    // 7. Write balanced journal entry if Accrual
    const config = await this.tenantConfigRepository.findByTenantId(tenantId);
    if (config && config.accountingMethod === AccountingMethod.Accrual) {
      await this.journalService.onKitDisassembly(
        tenantId,
        new Date(),
        `Disassemble ${quantity} units of Kit ${kitSku}`,
        referenceId,
        kitSku,
        totalDisassembledCost
      );
    }
  }
}
