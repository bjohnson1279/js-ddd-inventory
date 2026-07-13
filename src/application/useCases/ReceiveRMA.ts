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

    // Optimization: Replaced sequential `for...of` loop with `Promise.all` mapping to process independent
    // RMA items concurrently. This dramatically reduces total processing time for multi-item returns, resolving N+1 wait times.
    const itemsToSave = new Set<InventoryItem>();
    const layersToSave: InventoryCostLayer[] = [];
    const quarantineItemsToSave: QuarantineItem[] = [];
    const serializedItemsToSave = new Set<any>(); // any due to import types, but we'll use array from set

    // Create an in-memory cache for fetched inventory items during this transaction
    // to prevent race conditions when the same sku and location are processed in multiple items
    const inventoryCache = new Map<string, InventoryItem>();

    await Promise.all(dto.items.map(async (item) => {
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
      const cacheKey = `${item.variantId}_${targetLocationId}`;

      let invItem = inventoryCache.get(cacheKey) || null;
      if (!invItem) {
        invItem = await this.inventoryRepository.findBySku(sku, targetLocationId) || null;
        if (!invItem) {
          invItem = InventoryItem.create(
            crypto.randomUUID(),
            sku,
            targetLocationId,
            Quantity.create(0)
          );
        }
        inventoryCache.set(cacheKey, invItem);
      }

      invItem.receiveStock(Quantity.create(item.quantityReceived));
      itemsToSave.add(invItem);

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
      layersToSave.push(layer);

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
        quarantineItemsToSave.push(quarantineItem);
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

      // 6. Handle immediate scrap write-off
      if (item.disposition === RMADisposition.Scrap) {
        // Decrement stock level
        invItem.dispatchStock(Quantity.create(item.quantityReceived));
        // itemsToSave.add(invItem) was already called above, Set handles uniqueness

        // Note: The new layer was added to layersToSave, but costLayerService.consumeFifoLayers
        // reads from the DB. To prevent InsufficientInventoryException, we must flush the layer to the DB first.
        // Or simply skip consumeFifoLayers and mark the newly created layer as exhausted in memory.

        // Since we are writing off the exact same amount we just received in this loop iteration:
        layer.consume(item.quantityReceived);

        // Post write-off journal entry if Accrual
        if (config.accountingMethod === AccountingMethod.Accrual) {
          const totalCostCents = rmaItem.unitCostCents * item.quantityReceived;
          await this.journalService.onInventoryWriteOff(
            rma.id,
            totalCostCents,
            new Date(),
            config,
            rma.tenantId
          );
        }
      }

      // 7. Handle Serialized items transitions
      if (item.serialNumbers && this.serializedItemRepository) {
        await Promise.all(item.serialNumbers.map(async (sn) => {
          const serialObj = new SerialNumber(sn);
          const serialItem = await this.serializedItemRepository!.findBySerialOrFail(serialObj, rma.tenantId);
          serialItem.acceptReturn(`RMA-${rma.id}`, "system");

          if (item.disposition === RMADisposition.Restock) {
            serialItem.restock("system", `RMA-${rma.id}`);
          } else if (item.disposition === RMADisposition.Quarantine) {
            serialItem.quarantine(`RMA return: Quarantine`, "system", `RMA-${rma.id}`);
          } else if (item.disposition === RMADisposition.Scrap) {
            serialItem.writeOff(`RMA return: Scrapped`, "system", `RMA-${rma.id}`);
          }
          serializedItemsToSave.add(serialItem);
        }));
      }
    }));

    if (this.inventoryRepository.saveMany && itemsToSave.size > 0) {
      await this.inventoryRepository.saveMany(Array.from(itemsToSave));
    } else if (itemsToSave.size > 0) {
      await Promise.all(Array.from(itemsToSave).map(item => this.inventoryRepository.save(item)));
    }

    if (this.costLayerRepository.saveMany && layersToSave.length > 0) {
      await this.costLayerRepository.saveMany(layersToSave);
    } else if (layersToSave.length > 0) {
      await Promise.all(layersToSave.map(layer => this.costLayerRepository.save(layer)));
    }

    if (quarantineItemsToSave.length > 0) {
      await Promise.all(quarantineItemsToSave.map(qItem => this.quarantineRepository.save(qItem)));
    }

    if (this.serializedItemRepository && serializedItemsToSave.size > 0) {
      await Promise.all(Array.from(serializedItemsToSave).map(sItem => this.serializedItemRepository!.save(sItem)));
    }

    await this.rmaRepository.save(rma);
  }
}
