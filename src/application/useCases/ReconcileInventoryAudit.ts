import { IInventoryAuditRepository } from "../../domain/repositories/IInventoryAuditRepository";
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
import { CostingMethod } from "../../domain/accounting/enums/CostingMethod";
import { AccountingMethod } from "../../domain/accounting/enums/AccountingMethod";

export class ReconcileInventoryAudit {
  private readonly costLayerService: CostLayerService;
  private readonly journalService: AccountingJournalService;

  constructor(
    private readonly auditRepository: IInventoryAuditRepository,
    private readonly inventoryRepository: IInventoryRepository,
    private readonly costLayerRepository: ICostLayerRepository,
    private readonly tenantConfigRepository: ITenantConfigRepository,
    private readonly journalRepository: IJournalRepository
  ) {
    this.costLayerService = new CostLayerService(costLayerRepository);
    this.journalService = new AccountingJournalService(journalRepository, this.costLayerService);
  }

  async execute(auditId: string): Promise<void> {
    const audit = await this.auditRepository.findById(auditId);
    if (!audit) {
      throw new Error(`Inventory audit with ID ${auditId} not found.`);
    }

    // This will throw if status is not COMPLETED
    audit.reconcile();

    const config = await this.tenantConfigRepository.findByTenantId(audit.tenantId);
    if (!config) {
      throw new Error(`Tenant config not found for tenant ${audit.tenantId}.`);
    }

    const skusToFetch = audit.items
      .filter(i => i.discrepancy !== null && i.discrepancy !== 0)
      .map(i => SKU.create(i.variantId));

    let inventoryItems: InventoryItem[] = [];
    if (this.inventoryRepository.findBySkus && skusToFetch.length > 0) {
      inventoryItems = await this.inventoryRepository.findBySkus(skusToFetch, audit.locationId);
    } else if (skusToFetch.length > 0) {
      const fetchPromises = skusToFetch.map(sku => this.inventoryRepository.findBySku(sku, audit.locationId));
      const results = await Promise.all(fetchPromises);
      inventoryItems = results.filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined);
    }
    const inventoryItemsMap = new Map(inventoryItems.map(i => [i.sku.getValue(), i]));
    const modifiedInventoryItems = new Map<string, InventoryItem>();
    const newCostLayers: InventoryCostLayer[] = [];

    // Optimization: Replaced Promise.all map loop with sequential for-of loop to avoid DB concurrency exceptions and batch saves
    for (const item of audit.items) {
      const discrepancy = item.discrepancy;
      if (discrepancy === null || discrepancy === 0) {
        continue;
      }

      const sku = SKU.create(item.variantId);
      let inventoryItem = modifiedInventoryItems.get(sku.getValue()) || inventoryItemsMap.get(sku.getValue()) || null;

      if (discrepancy < 0) {
        // Shrinkage (Negative discrepancy)
        if (!inventoryItem) {
          throw new Error(`Inventory item for variant ${item.variantId} not found at location ${audit.locationId} to apply shrinkage.`);
        }

        // 1. Decrement stock
        inventoryItem.dispatchStock(Quantity.create(Math.abs(discrepancy)));
        modifiedInventoryItems.set(sku.getValue(), inventoryItem);

        // 2. Consume cost layers and post journal entries if Accrual
        if (config.accountingMethod === AccountingMethod.Accrual) {
          let totalCostCents = 0;
          if (config.costingMethod === CostingMethod.FIFO) {
            const breakdown = await this.costLayerService.consumeFifoLayers(item.variantId, Math.abs(discrepancy));
            totalCostCents = breakdown.totalCostCents;
          } else if (config.costingMethod === CostingMethod.WeightedAverageCost) {
            const breakdown = await this.costLayerService.calculateWeightedAverageCost(item.variantId, Math.abs(discrepancy));
            totalCostCents = breakdown.totalCostCents;
          }

          await this.journalService.onInventoryAuditReconciliation(
            audit.id,
            item.variantId,
            discrepancy,
            totalCostCents,
            new Date(),
            config,
            audit.tenantId
          );
        }
      } else {
        // Gain (Positive discrepancy)
        // 1. Increment stock
        if (!inventoryItem) {
          inventoryItem = InventoryItem.create(
            crypto.randomUUID(),
            sku,
            audit.locationId,
            Quantity.create(0)
          );
        }
        inventoryItem.receiveStock(Quantity.create(discrepancy));
        modifiedInventoryItems.set(sku.getValue(), inventoryItem);

        // 2. Find last receipt unit cost, fallback to 0
        const activeLayers = await this.costLayerRepository.getActiveLayers(item.variantId, "desc");
        const unitCostCents = activeLayers.length > 0 ? activeLayers[0].unitCostCents : 0;
        const totalCostCents = unitCostCents * discrepancy;

        // 3. Create a new cost layer
        const layerId = crypto.randomUUID();
        const newLayer = new InventoryCostLayer(
          layerId,
          item.variantId,
          audit.tenantId,
          discrepancy,
          unitCostCents,
          new Date(),
          `AUDIT-${audit.id}`,
          audit.locationId
        );
        newCostLayers.push(newLayer);

        // 4. Post journal entries if Accrual and cost > 0
        if (totalCostCents > 0) {
          await this.journalService.onInventoryAuditReconciliation(
            audit.id,
            item.variantId,
            discrepancy,
            totalCostCents,
            new Date(),
            config,
            audit.tenantId
          );
        }
      }
    }

    if (modifiedInventoryItems.size > 0) {
      if (this.inventoryRepository.saveMany) {
        await this.inventoryRepository.saveMany(Array.from(modifiedInventoryItems.values()));
      } else {
        await Promise.all(Array.from(modifiedInventoryItems.values()).map(item => this.inventoryRepository.save(item)));
      }
    }

    if (newCostLayers.length > 0) {
      if (this.costLayerRepository.saveMany) {
        await this.costLayerRepository.saveMany(newCostLayers);
      } else {
        await Promise.all(newCostLayers.map(layer => this.costLayerRepository.save(layer)));
      }
    }

    // Save the reconciled audit
    await this.auditRepository.save(audit);
  }
}
