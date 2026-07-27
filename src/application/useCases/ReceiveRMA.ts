import { IRMARepository } from "../../domain/repositories/IRMARepository";
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { IQuarantineRepository } from "../../domain/repositories/IQuarantineRepository";
import { ITenantConfigRepository } from "../../domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../domain/repositories/IJournalRepository";
import { ISerializedItemRepository } from "../../domain/repositories/ISerializedItemRepository";
import { RMADisposition } from "../../domain/returns/enums/RMADisposition";
import { QuarantineItem } from "../../domain/returns/aggregates/QuarantineItem";
import { InventoryCostLayer } from "../../domain/accounting/entities/InventoryCostLayer";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { InventoryItem } from "../../domain/aggregates/InventoryItem";
import { CostLayerService } from "../../domain/accounting/services/CostLayerService";
import { AccountingJournalService } from "../../domain/accounting/services/AccountingJournalService";
import { AccountingMethod } from "../../domain/accounting/enums/AccountingMethod";
import { SerialNumber } from "../../domain/serial/valueObjects/SerialNumber";

export interface ReceiveRMAItemDTO {
  variantId: string;
  quantityReceived: number;
  disposition: RMADisposition;
  serialNumbers?: string[];
}

export interface ReceiveRMADTO {
  rmaId: string;
  items: ReceiveRMAItemDTO[];
}

export class ReceiveRMA {
  private readonly costLayerService: CostLayerService;
  private readonly journalService: AccountingJournalService;

  constructor(
    private readonly rmaRepository: IRMARepository,
    private readonly inventoryRepository: IInventoryRepository,
    private readonly costLayerRepository: ICostLayerRepository,
    private readonly quarantineRepository: IQuarantineRepository,
    private readonly tenantConfigRepository: ITenantConfigRepository,
    private readonly journalRepository: IJournalRepository,
    private readonly serializedItemRepository?: ISerializedItemRepository
  ) {
    this.costLayerService = new CostLayerService(costLayerRepository);
    this.journalService = new AccountingJournalService(journalRepository, this.costLayerService);
  }

  async execute(dto: ReceiveRMADTO): Promise<void> {
    const rma = await this.rmaRepository.findById(dto.rmaId);
    if (!rma) {
      throw new Error(`RMA with ID ${dto.rmaId} not found.`);
    }

    const config = await this.tenantConfigRepository.findByTenantId(rma.tenantId);
    if (!config) {
      throw new Error(`Tenant config not found for tenant ${rma.tenantId}.`);
    }

    // Optimization: Index RMA items by variantId to prevent O(N*M) nested lookups
    const rmaItemsMap = new Map(rma.items.map((i) => [i.variantId, i]));

    // Optimization: Pre-fetch all required inventory items in batches to avoid N+1 DB lookups
    const skusByLocation = new Map<string, SKU[]>();
    for (const item of dto.items) {
      const targetLoc = item.disposition === RMADisposition.Quarantine
          ? `${rma.locationId}-quarantine`
          : rma.locationId;
      if (!skusByLocation.has(targetLoc)) skusByLocation.set(targetLoc, []);
      skusByLocation.get(targetLoc)!.push(SKU.create(item.variantId));
    }

    const inventoryItemsMap = new Map<string, InventoryItem>();
    if (this.inventoryRepository.findBySkus) {
      for (const [loc, skus] of skusByLocation.entries()) {
        const fetched = await this.inventoryRepository.findBySkus(skus, loc);
        for (const item of fetched) {
          inventoryItemsMap.set(`${item.sku.getValue()}__${loc}`, item);
        }
      }
    } else {
      // Fallback if findBySkus is not implemented
      for (const [loc, skus] of skusByLocation.entries()) {
        const fetchPromises = skus.map(async (sku) => {
          const item = await this.inventoryRepository.findBySku(sku, loc);
          if (item) inventoryItemsMap.set(`${item.sku.getValue()}__${loc}`, item);
        });
        await Promise.all(fetchPromises);
      }
    }

    const modifiedInventoryItems = new Map<string, InventoryItem>();
    const newCostLayers: InventoryCostLayer[] = [];

    // Optimization: Replaced Promise.all map loop with sequential for-of loop to avoid DB concurrency exceptions on identical SKUs
    for (const item of dto.items) {
      const rmaItem = rmaItemsMap.get(item.variantId);
      if (!rmaItem) {
        throw new Error(`Item with variant ID ${item.variantId} not found in RMA ${rma.rmaNumber}.`);
      }

      // 1. Process receipt on RMA aggregate
      rma.receiveItem(item.variantId, item.quantityReceived, item.disposition);

      const targetLocationId =
        item.disposition === RMADisposition.Quarantine
          ? `${rma.locationId}-quarantine`
          : rma.locationId;

      // 2. Increment stock level
      const sku = SKU.create(item.variantId);
      const cacheKey = `${item.variantId}__${targetLocationId}`;
      let invItem = modifiedInventoryItems.get(cacheKey) || inventoryItemsMap.get(cacheKey);

      if (!invItem) {
        invItem = InventoryItem.create(
          crypto.randomUUID(),
          sku,
          targetLocationId,
          Quantity.create(0)
        );
      }
      invItem.receiveStock(Quantity.create(item.quantityReceived));
      modifiedInventoryItems.set(cacheKey, invItem);

      // 3. Create Cost Layer
      const layerId = crypto.randomUUID();
      const layer = new InventoryCostLayer(
        layerId,
        item.variantId,
        rma.tenantId,
        item.quantityReceived,
        rmaItem.unitCostCents,
        new Date(),
        `RMA-${rma.id}`,
        targetLocationId
      );
      newCostLayers.push(layer);

      // 4. Create Quarantine record if quarantined
      if (item.disposition === RMADisposition.Quarantine) {
        const qId = crypto.randomUUID();
        const quarantineItem = new QuarantineItem(
          qId,
          item.variantId,
          item.quantityReceived,
          `Returned from RMA ${rma.rmaNumber}`,
          rma.locationId,
          rma.tenantId
        );
        await this.quarantineRepository.save(quarantineItem);
      }

      // 5. Post return journal entries if Accrual
      if (config.accountingMethod === AccountingMethod.Accrual) {
        const totalCostCents = rmaItem.unitCostCents * item.quantityReceived;
        await this.journalService.onStockReturned(
          item.variantId,
          totalCostCents,
          rma.id,
          new Date(),
          config,
          rma.tenantId
        );
      }

      // 6. Handle immediate scrap write-off (stock only)
      if (item.disposition === RMADisposition.Scrap) {
        invItem.dispatchStock(Quantity.create(item.quantityReceived));
        modifiedInventoryItems.set(cacheKey, invItem);
      }

      // 7. Handle Serialized items transitions
      if (item.serialNumbers && this.serializedItemRepository) {
        let serialItems = [];
        const serialObjects = item.serialNumbers.map(sn => new SerialNumber(sn));

        if (this.serializedItemRepository.findBySerials) {
          serialItems = await this.serializedItemRepository.findBySerials(serialObjects, rma.tenantId);
          if (serialItems.length !== item.serialNumbers.length) {
            throw new Error(`Not all serial numbers found for RMA ${rma.rmaNumber}`);
          }
        } else {
          // Fallback
          serialItems = await Promise.all(serialObjects.map(obj =>
            this.serializedItemRepository!.findBySerialOrFail(obj, rma.tenantId)
          ));
        }

        for (const serialItem of serialItems) {
          serialItem.acceptReturn(`RMA-${rma.id}`, "system");

          if (item.disposition === RMADisposition.Restock) {
            serialItem.restock("system", `RMA-${rma.id}`);
          } else if (item.disposition === RMADisposition.Quarantine) {
            serialItem.quarantine(`RMA return: Quarantine`, "system", `RMA-${rma.id}`);
          } else if (item.disposition === RMADisposition.Scrap) {
            serialItem.writeOff(`RMA return: Scrapped`, "system", `RMA-${rma.id}`);
          }
        }

        if (this.serializedItemRepository.saveMany) {
          await this.serializedItemRepository.saveMany(serialItems);
        } else {
          for (const serialItem of serialItems) {
            await this.serializedItemRepository.save(serialItem);
          }
        }
      }
    }

    // Save batch inventory items
    if (modifiedInventoryItems.size > 0) {
      if (this.inventoryRepository.saveMany) {
        await this.inventoryRepository.saveMany(Array.from(modifiedInventoryItems.values()));
      } else {
        await Promise.all(Array.from(modifiedInventoryItems.values()).map(item => this.inventoryRepository.save(item)));
      }
    }

    // Save batch cost layers
    if (newCostLayers.length > 0) {
      if (this.costLayerRepository.saveMany) {
        await this.costLayerRepository.saveMany(newCostLayers);
      } else {
        await Promise.all(newCostLayers.map(layer => this.costLayerRepository.save(layer)));
      }
    }

    // Process immediate scrap write-offs (cost consumption & journal) AFTER cost layers have been persisted
    for (const item of dto.items) {
      if (item.disposition === RMADisposition.Scrap) {
        const rmaItem = rmaItemsMap.get(item.variantId);
        await this.costLayerService.consumeFifoLayers(item.variantId, item.quantityReceived);

        if (config.accountingMethod === AccountingMethod.Accrual) {
          const totalCostCents = (rmaItem?.unitCostCents || 0) * item.quantityReceived;
          await this.journalService.onInventoryWriteOff(
            rma.id,
            totalCostCents,
            new Date(),
            config,
            rma.tenantId
          );
        }
      }
    }

    await this.rmaRepository.save(rma);
  }
}
