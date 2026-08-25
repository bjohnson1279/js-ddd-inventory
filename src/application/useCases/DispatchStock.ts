import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { IExternalInventoryPublisher } from "../ports/IExternalInventoryPublisher";
import { ReorderPolicyService } from "../../domain/procurement/services/ReorderPolicyService";
import { IDispatchRecordRepository, DispatchRecord } from "../../domain/repositories/IDispatchRecordRepository";
import { ICostLayerRepository } from "../../domain/repositories/ICostLayerRepository";
import { IProductRepository } from "../../domain/repositories/IProductRepository";

export class DispatchStock {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly externalPublisher?: IExternalInventoryPublisher,
    private readonly reorderPolicyService?: ReorderPolicyService,
    private readonly dispatchRecordRepository?: IDispatchRecordRepository,
    private readonly productRepository?: IProductRepository,
    private readonly costLayerRepository?: ICostLayerRepository
  ) {}

  async executeBatch(
    requests: {
      skuStr: string;
      amount: number;
      locationId?: string;
      skipPublishing?: boolean;
      lotNumber?: string;
    }[]
  ): Promise<void> {
    if (requests.length === 0) return;

    let items = [];
    if (this.inventoryRepository.findBySkus) {
      const byLocation = new Map<string, { sku: SKU; amount: number; skipPublishing: boolean; lotNumber?: string }[]>();
      for (const req of requests) {
        const locId = req.locationId || "default";
        const arr = byLocation.get(locId) || [];
        arr.push({ sku: SKU.create(req.skuStr), amount: req.amount, skipPublishing: !!req.skipPublishing, lotNumber: req.lotNumber });
        byLocation.set(locId, arr);
      }

      for (const [locId, reqs] of byLocation.entries()) {
        const skus = reqs.map(r => r.sku);
        const locItems = await this.inventoryRepository.findBySkus(skus, locId);

        for (const req of reqs) {
          const item = locItems.find(i => i.sku.getValue() === req.sku.getValue());
          if (!item) throw new Error("Item not found in inventory");

          item.dispatchStock(Quantity.create(req.amount));
          items.push(item);

          if (this.reorderPolicyService) {
            await this.reorderPolicyService.checkPolicy(req.sku.getValue(), locId, item.quantity.getValue());
          }

          if (this.externalPublisher && !req.skipPublishing) {
            await this.externalPublisher.publishStockLevel(req.sku, item.quantity);
          }
        }
      }
    } else {
      await Promise.all(requests.map(r => this.execute(r.skuStr, r.amount, r.locationId, r.skipPublishing, r.lotNumber)));
      return;
    }

    if (items.length > 0) {
      if (this.inventoryRepository.saveMany) {
        await this.inventoryRepository.saveMany(items);
      } else {
        await Promise.all(items.map(item => this.inventoryRepository.save(item)));
      }
    }

    if (this.costLayerRepository && this.productRepository) {
      const uniqueSkus = Array.from(new Set(requests.map(r => r.skuStr)));
      const skus = uniqueSkus.map(s => SKU.create(s));
      const products = await this.productRepository.findBySkus(skus);

      const variantIds: string[] = [];
      const productMap = new Map<string, any>();
      for (const product of products) {
        for (const skuStr of uniqueSkus) {
           const v = product.findVariantBySku(skuStr);
           if (v) {
             productMap.set(skuStr, product);
             variantIds.push(v.id);
           }
        }
      }

      let activeLayersMap = new Map<string, any[]>();
      if (this.costLayerRepository.getActiveLayersByVariantIds) {
        activeLayersMap = await this.costLayerRepository.getActiveLayersByVariantIds(variantIds, "expiration_date ASC");
      } else {
        await Promise.all(variantIds.map(async vid => {
          const layers = await this.costLayerRepository!.getActiveLayers(vid, "expiration_date ASC");
          activeLayersMap.set(vid, layers);
        }));
      }

      const layersToSave: any[] = [];
      const dispatchRecordsToSave: DispatchRecord[] = [];

      for(const req of requests) {
        const product = productMap.get(req.skuStr);
        if (product) {
            const variant = product.findVariantBySku(req.skuStr);
            if (variant) {
              const activeLayers = activeLayersMap.get(variant.id) || [];
              const targetLayers = req.lotNumber
                ? activeLayers.filter((l: any) => l.lotNumber === req.lotNumber)
                : activeLayers;

              let remaining = req.amount;
              for (const layer of targetLayers) {
                if (remaining <= 0) break;
                const consumed = layer.consume(remaining);
                remaining -= consumed;

                if (this.dispatchRecordRepository && consumed > 0) {
                  dispatchRecordsToSave.push(new DispatchRecord("", req.skuStr, req.locationId || "default", consumed, new Date(), layer.lotNumber));
                }
                if (!layersToSave.includes(layer)) {
                  layersToSave.push(layer);
                }
              }

              if (remaining > 0 && req.lotNumber) {
                throw new Error(`Insufficient stock in lot ${req.lotNumber} to dispatch ${req.amount} units.`);
              }
            }
        }
      }

      if (layersToSave.length > 0) {
        if (this.costLayerRepository.saveMany) {
          await this.costLayerRepository.saveMany(layersToSave);
        } else {
          await Promise.all(layersToSave.map(l => this.costLayerRepository!.save(l)));
        }
      }

      if (dispatchRecordsToSave.length > 0 && this.dispatchRecordRepository) {
        // DispatchRecordRepository doesn't have saveMany in the interface based on previous search,
        // actually let's check it. Wait, the interface is: save(record: DispatchRecord, tx?: any): Promise<void>;
        await Promise.all(dispatchRecordsToSave.map(r => this.dispatchRecordRepository!.save(r)));
      }

    } else if (this.dispatchRecordRepository) {
      await Promise.all(requests.map(req =>
         this.dispatchRecordRepository!.save(
           new DispatchRecord("", req.skuStr, req.locationId || "default", req.amount, new Date(), req.lotNumber)
         )
      ));
    }
  }

  async execute(
    skuStr: string,
    amount: number,
    locationId: string = "default",
    skipPublishing: boolean = false,
    lotNumber?: string
  ): Promise<void> {
    const sku = SKU.create(skuStr);
    const quantityToSubtract = Quantity.create(amount);

    const item = await this.inventoryRepository.findBySku(sku, locationId);

    if (!item) {
      throw new Error("Item not found in inventory");
    }

    item.dispatchStock(quantityToSubtract);

    await this.inventoryRepository.save(item);

    // Consume cost layers and record lot-specific dispatches
    if (this.costLayerRepository && this.productRepository) {
      const product = await this.productRepository.findBySku(sku);
      if (product) {
        const variant = product.findVariantBySku(skuStr);
        if (variant) {
          const activeLayers = await this.costLayerRepository.getActiveLayers(variant.id, "expiration_date ASC");
          const targetLayers = lotNumber
            ? activeLayers.filter((l) => l.lotNumber === lotNumber)
            : activeLayers;

          let remaining = amount;
          for (const layer of targetLayers) {
            if (remaining <= 0) break;
            const consumed = layer.consume(remaining);
            remaining -= consumed;

            if (this.dispatchRecordRepository && consumed > 0) {
              await this.dispatchRecordRepository.save(
                new DispatchRecord("", skuStr, locationId, consumed, new Date(), layer.lotNumber)
              );
            }
          }

          if (remaining > 0 && lotNumber) {
            throw new Error(`Insufficient stock in lot ${lotNumber} to dispatch ${amount} units.`);
          }

          const costRepo = this.costLayerRepository;
          if (costRepo.saveMany) {
            await costRepo.saveMany(activeLayers);
          } else {
            await Promise.all(activeLayers.map((l) => costRepo.save(l)));
          }
        }
      }
    } else {
      // Record historical dispatch for velocity tracking and demand forecasting
      if (this.dispatchRecordRepository) {
        await this.dispatchRecordRepository.save(
          new DispatchRecord("", skuStr, locationId, amount, new Date(), lotNumber)
        );
      }
    }

    if (this.reorderPolicyService) {
      await this.reorderPolicyService.checkPolicy(skuStr, locationId, item.quantity.getValue());
    }

    if (this.externalPublisher && !skipPublishing) {
      await this.externalPublisher.publishStockLevel(sku, item.quantity);
    }
  }
}
