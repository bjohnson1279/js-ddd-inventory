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

    // Optimization: Pre-fetch all serialized items to avoid N+1 DB lookups inside the loop
    const allSerialObjects: SerialNumber[] = [];
    let expectedTotalSerials = 0;
    for (const item of dto.items) {
      if (item.serialNumbers) {
        allSerialObjects.push(...item.serialNumbers.map(sn => new SerialNumber(sn)));
        expectedTotalSerials += item.serialNumbers.length;
      }
    }

    const serializedItemsMap = new Map<string, any>(); // Map<string, SerializedItem>
    if (allSerialObjects.length > 0 && this.serializedItemRepository) {
      let fetchedSerials = [];
      if (this.serializedItemRepository.findBySerials) {
        fetchedSerials = await this.serializedItemRepository.findBySerials(allSerialObjects, rma.tenantId);
        if (fetchedSerials.length !== expectedTotalSerials) {
          throw new Error(`Not all serial numbers found for RMA ${rma.rmaNumber}`);
        }
      } else {
        fetchedSerials = await Promise.all(allSerialObjects.map(obj =>
          this.serializedItemRepository!.findBySerialOrFail(obj, rma.tenantId)
        ));
      }
      for (const serialItem of fetchedSerials) {
        serializedItemsMap.set(serialItem.serialNumber.value, serialItem);
      }
    }

    const modifiedInventoryItems = new Map<string, InventoryItem>();
    const newCostLayers: InventoryCostLayer[] = [];
    const modifiedSerialItems: any[] = [];
    const journalPromises: Promise<any>[] = [];
    const newQuarantineItems: any[] = []; // QuarantineItem[]

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
        newQuarantineItems.push(quarantineItem);
      }

      // 5. Post return journal entries if Accrual
      if (config.accountingMethod === AccountingMethod.Accrual) {
        const totalCostCents = rmaItem.unitCostCents * item.quantityReceived;
        journalPromises.push(
          this.journalService.onStockReturned(
            item.variantId,
            totalCostCents,
            rma.id,
            new Date(),
            config,
            rma.tenantId
          )
        );
      }

      // 6. Handle immediate scrap write-off (stock only)
      if (item.disposition === RMADisposition.Scrap) {
        invItem.dispatchStock(Quantity.create(item.quantityReceived));
        modifiedInventoryItems.set(cacheKey, invItem);
      }

      // 7. Handle Serialized items transitions
      if (item.serialNumbers && this.serializedItemRepository) {
        const serialItems = item.serialNumbers.map(sn => {
          const serialObj = new SerialNumber(sn);
          const found = serializedItemsMap.get(serialObj.value);
          if (!found) {
             throw new Error(`Not all serial numbers found for RMA ${rma.rmaNumber}`);
          }
          return found;
        });

        for (const serialItem of serialItems) {
          serialItem.acceptReturn(`RMA-${rma.id}`, "system");

          if (item.disposition === RMADisposition.Restock) {
            serialItem.restock("system", `RMA-${rma.id}`);
          } else if (item.disposition === RMADisposition.Quarantine) {
            serialItem.quarantine(`RMA return: Quarantine`, "system", `RMA-${rma.id}`);
          } else if (item.disposition === RMADisposition.Scrap) {
            serialItem.writeOff(`RMA return: Scrapped`, "system", `RMA-${rma.id}`);
          }
          modifiedSerialItems.push(serialItem);
        }
      }
    }

    if (journalPromises.length > 0) {
      await Promise.all(journalPromises);
    }

    if (modifiedSerialItems.length > 0 && this.serializedItemRepository) {
      if (this.serializedItemRepository.saveMany) {
        await this.serializedItemRepository.saveMany(modifiedSerialItems);
      } else {
        await Promise.all(modifiedSerialItems.map(item => this.serializedItemRepository!.save(item)));
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

    // Save batch quarantine items
    if (newQuarantineItems.length > 0) {
      if (this.quarantineRepository.saveMany) {
        await this.quarantineRepository.saveMany(newQuarantineItems);
      } else {
        await Promise.all(newQuarantineItems.map(item => this.quarantineRepository.save(item)));
      }
    }

    // Process immediate scrap write-offs (cost consumption & journal) AFTER cost layers have been persisted
    const scrapItems = dto.items.filter(item => item.disposition === RMADisposition.Scrap);

    if (scrapItems.length > 0) {
      // Optimization: Batch consume FIFO layers to avoid N+1 DB lookups
      const componentsToConsume = scrapItems.map(item => ({
        variantId: item.variantId,
        quantity: item.quantityReceived
      }));
      await this.costLayerService.consumeFifoLayersBatch(componentsToConsume);

      if (config.accountingMethod === AccountingMethod.Accrual) {
        // Optimization: Execute journal entries concurrently to prevent N+1 I/O latency
        const date = new Date();
        const writeOffPromises = scrapItems.map(item => {
          const rmaItem = rmaItemsMap.get(item.variantId);
          const totalCostCents = (rmaItem?.unitCostCents || 0) * item.quantityReceived;
          return this.journalService.onInventoryWriteOff(
            rma.id,
            totalCostCents,
            date,
            config,
            rma.tenantId
          );
        });
        await Promise.all(writeOffPromises);
      }
    }

    await this.rmaRepository.save(rma);
  }
}
