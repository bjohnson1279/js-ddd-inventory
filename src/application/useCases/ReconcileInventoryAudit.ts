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

    const uniqueVariantIdsToFetch = Array.from(new Set(
      audit.items
        .filter(i => i.discrepancy !== null && i.discrepancy !== 0)
        .map(i => i.variantId)
    ));
    const skusToFetch = uniqueVariantIdsToFetch.map(id => SKU.create(id));

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

    // Pre-calculate shrinkage components for batch consumption to avoid N+1 queries
    const shrinkages: { variantId: string; quantity: number }[] = [];
    if (config.accountingMethod === AccountingMethod.Accrual && (config.costingMethod === CostingMethod.FIFO || config.costingMethod === CostingMethod.WeightedAverageCost)) {
      for (const item of audit.items) {
        if (item.discrepancy !== null && item.discrepancy < 0) {
          shrinkages.push({
            variantId: item.variantId,
            quantity: Math.abs(item.discrepancy)
          });
        }
      }
    }

    const fifoBreakdownsMap = new Map<string, number>();
    const weightedAverageBreakdownsMap = new Map<string, number>();
    if (shrinkages.length > 0) {
      if (config.costingMethod === CostingMethod.FIFO) {
        const breakdowns = await this.costLayerService.consumeFifoLayersBatch(shrinkages);
        for (let i = 0; i < shrinkages.length; i++) {
          fifoBreakdownsMap.set(shrinkages[i].variantId, breakdowns[i].totalCostCents);
        }
      } else if (config.costingMethod === CostingMethod.WeightedAverageCost) {
        const breakdowns = await this.costLayerService.calculateWeightedAverageCostBatch(shrinkages);
        for (let i = 0; i < shrinkages.length; i++) {
          weightedAverageBreakdownsMap.set(shrinkages[i].variantId, breakdowns[i].totalCostCents);
        }
      }
    }

    const journalPromises: Promise<any>[] = [];

    // Optimization: Pre-fetch all required active layers in a single batch to avoid N+1 DB lookups during positive discrepancies
    let activeLayersMap = new Map<string, InventoryCostLayer[]>();
    const positiveDiscrepancyVariantIds = audit.items
      .filter(item => item.discrepancy !== null && item.discrepancy > 0)
      .map(item => item.variantId);

    if (positiveDiscrepancyVariantIds.length > 0) {
      // Optimization: Deduplicate variant IDs and pre-fetch layers concurrently to avoid N+1 DB lookups
      const uniqueVariantIds = Array.from(new Set(positiveDiscrepancyVariantIds));
      if ('getActiveLayersByVariantIds' in this.costLayerRepository && typeof (this.costLayerRepository as any).getActiveLayersByVariantIds === 'function') {
        const result = await (this.costLayerRepository as any).getActiveLayersByVariantIds(uniqueVariantIds, "desc");
        // Safely handle both Map and Object return types from the repository
        if (result instanceof Map) {
          activeLayersMap = result;
        } else {
          for (const [key, value] of Object.entries(result)) {
            activeLayersMap.set(key, value as InventoryCostLayer[]);
          }
        }
      } else {
        const layersPromises = uniqueVariantIds.map(async variantId => {
          const layers = await this.costLayerRepository.getActiveLayers(variantId, "desc");
          activeLayersMap.set(variantId, layers);
        });
        await Promise.all(layersPromises);
      }
    }

    await Promise.all(audit.items.map(async (item) => {
      const discrepancy = item.discrepancy;
      if (discrepancy === null || discrepancy === 0) {
        return;
      }

      const sku = SKU.create(item.variantId);
      const skuValue = sku.getValue();
      let inventoryItem = modifiedInventoryItems.get(skuValue) || inventoryItemsMap.get(skuValue) || null;

      if (discrepancy < 0) {
        // Shrinkage (Negative discrepancy)
        if (!inventoryItem) {
          throw new Error(`Inventory item for variant ${item.variantId} not found at location ${audit.locationId} to apply shrinkage.`);
        }

        // 1. Decrement stock
        inventoryItem.dispatchStock(Quantity.create(Math.abs(discrepancy)));
        modifiedInventoryItems.set(skuValue, inventoryItem);

        // 2. Consume cost layers and post journal entries if Accrual
        if (config.accountingMethod === AccountingMethod.Accrual) {
          let totalCostCents = 0;
          if (config.costingMethod === CostingMethod.FIFO) {
            totalCostCents = fifoBreakdownsMap.get(item.variantId) || 0;
          } else if (config.costingMethod === CostingMethod.WeightedAverageCost) {
            totalCostCents = weightedAverageBreakdownsMap.get(item.variantId) || 0;
          }

          const p = this.journalService.onInventoryAuditReconciliation(
            audit.id,
            item.variantId,
            discrepancy,
            totalCostCents,
            new Date(),
            config,
            audit.tenantId
          );
          p.catch(() => {});
          journalPromises.push(p);
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
        modifiedInventoryItems.set(skuValue, inventoryItem);

        // 2. Find last receipt unit cost, fallback to 0
        const activeLayers = activeLayersMap.get(item.variantId) || [];
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
          const p = this.journalService.onInventoryAuditReconciliation(
            audit.id,
            item.variantId,
            discrepancy,
            totalCostCents,
            new Date(),
            config,
            audit.tenantId
          );
          p.catch(() => {});
          journalPromises.push(p);
        }
      }
    }));

    await Promise.all(journalPromises);

    // Save batched inventory items
    if (modifiedInventoryItems.size > 0) {
      if ('saveMany' in this.inventoryRepository && typeof (this.inventoryRepository as any).saveMany === 'function') {
        await (this.inventoryRepository as any).saveMany(Array.from(modifiedInventoryItems.values()));
      } else {
        // Optimization: Execute chunked Promise.all for sequential DB saves instead of concurrent batch
        const items = Array.from(modifiedInventoryItems.values());
        for (let i = 0; i < items.length; i += 50) {
          const chunk = items.slice(i, i + 50);
          await Promise.all(chunk.map(item => this.inventoryRepository.save(item)));
        }
      }
    }

    // Save batched cost layers
    if (newCostLayers.length > 0) {
      if ('saveMany' in this.costLayerRepository && typeof (this.costLayerRepository as any).saveMany === 'function') {
        await (this.costLayerRepository as any).saveMany(newCostLayers);
      } else {
        // Optimization: Execute chunked Promise.all for sequential DB saves instead of concurrent batch
        for (let i = 0; i < newCostLayers.length; i += 50) {
          const chunk = newCostLayers.slice(i, i + 50);
          await Promise.all(chunk.map(layer => this.costLayerRepository.save(layer)));
        }
      }
    }

    // Save the reconciled audit
    await this.auditRepository.save(audit);
  }
}
