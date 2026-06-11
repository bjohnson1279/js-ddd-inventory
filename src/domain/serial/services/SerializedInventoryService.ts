import { ISerializedItemRepository } from "../../repositories/ISerializedItemRepository";
import { IInventoryRepository } from "../../repositories/IInventoryRepository";
import { SerialNumber } from "../valueObjects/SerialNumber";
import { SerializedItem } from "../aggregates/SerializedItem";
import { SerializedItemStatus } from "../enums/SerializedItemStatus";
import { SKU } from "../../valueObjects/SKU";
import { Quantity } from "../../valueObjects/Quantity";
import { InventoryItem } from "../../aggregates/InventoryItem";
import { SerialNumberAlreadyRegisteredException } from "../exceptions/SerialNumberAlreadyRegisteredException";
import { DomainEventDispatcher } from "../../events/DomainEventDispatcher";

export class SerializedInventoryService {
  constructor(
    private readonly serials: ISerializedItemRepository,
    private readonly inventoryRepository: IInventoryRepository
  ) {}

  public async register(
    serialNumber: SerialNumber,
    variantId: string,
    tenantId: string,
    locationId: string,
    actorId: string
  ): Promise<SerializedItem> {
    if (await this.serials.isRegistered(serialNumber, tenantId)) {
      throw new SerialNumberAlreadyRegisteredException(serialNumber);
    }

    const item = new SerializedItem(
      crypto.randomUUID(),
      variantId,
      serialNumber,
      tenantId,
      locationId,
      SerializedItemStatus.Pending
    );

    await this.serials.save(item);
    return item;
  }

  public async receive(
    serialNumber: SerialNumber,
    tenantId: string,
    location: string,
    purchaseOrderId: string,
    actorId: string
  ): Promise<void> {
    const item = await this.serials.findBySerialOrFail(serialNumber, tenantId);

    item.receive(location, actorId, purchaseOrderId);

    const sku = SKU.create(item.variantId);
    let invItem = await this.inventoryRepository.findBySku(sku, item.locationId);
    if (!invItem) {
      invItem = InventoryItem.create(
        crypto.randomUUID(),
        sku,
        item.locationId,
        Quantity.create(0)
      );
    }
    invItem.receiveStock(Quantity.create(1));
    await this.inventoryRepository.save(invItem);

    await this.serials.save(item);
    await this.dispatchEvents(item);
  }

  public async sell(
    serialNumber: SerialNumber,
    tenantId: string,
    saleId: string,
    actorId: string
  ): Promise<void> {
    const item = await this.serials.findBySerialOrFail(serialNumber, tenantId);

    item.sell(saleId, actorId);

    const sku = SKU.create(item.variantId);
    let invItem = await this.inventoryRepository.findBySku(sku, item.locationId);
    if (!invItem) {
      invItem = InventoryItem.create(
        crypto.randomUUID(),
        sku,
        item.locationId,
        Quantity.create(0)
      );
    }
    invItem.dispatchStock(Quantity.create(1));
    await this.inventoryRepository.save(invItem);

    await this.serials.save(item);
    await this.dispatchEvents(item);
  }

  public async acceptReturn(
    serialNumber: SerialNumber,
    tenantId: string,
    returnId: string,
    actorId: string
  ): Promise<void> {
    const item = await this.serials.findBySerialOrFail(serialNumber, tenantId);

    item.acceptReturn(returnId, actorId);

    await this.serials.save(item);
    await this.dispatchEvents(item);
  }

  public async restock(
    serialNumber: SerialNumber,
    tenantId: string,
    returnId: string,
    actorId: string
  ): Promise<void> {
    const item = await this.serials.findBySerialOrFail(serialNumber, tenantId);

    item.restock(actorId, returnId);

    const sku = SKU.create(item.variantId);
    let invItem = await this.inventoryRepository.findBySku(sku, item.locationId);
    if (!invItem) {
      invItem = InventoryItem.create(
        crypto.randomUUID(),
        sku,
        item.locationId,
        Quantity.create(0)
      );
    }
    invItem.receiveStock(Quantity.create(1));
    await this.inventoryRepository.save(invItem);

    await this.serials.save(item);
    await this.dispatchEvents(item);
  }

  public async writeOff(
    serialNumber: SerialNumber,
    tenantId: string,
    reason: string,
    actorId: string,
    referenceId: string | null = null
  ): Promise<void> {
    const item = await this.serials.findBySerialOrFail(serialNumber, tenantId);

    const wasInStock = item.status === SerializedItemStatus.InStock;

    item.writeOff(reason, actorId, referenceId);

    if (wasInStock) {
      const sku = SKU.create(item.variantId);
      let invItem = await this.inventoryRepository.findBySku(sku, item.locationId);
      if (!invItem) {
        invItem = InventoryItem.create(
          crypto.randomUUID(),
          sku,
          item.locationId,
          Quantity.create(0)
        );
      }
      invItem.dispatchStock(Quantity.create(1));
      await this.inventoryRepository.save(invItem);
    }

    await this.serials.save(item);
    await this.dispatchEvents(item);
  }

  public async isConsistentWithLedger(variantId: string): Promise<boolean> {
    const allItems = await this.inventoryRepository.findAll();
    const skuItems = allItems.filter(item => item.sku.getValue() === variantId);
    const ledgerQty = skuItems.reduce((acc, item) => acc + item.quantity.getValue(), 0);
    const inStockCount = await this.serials.countByStatus(variantId, SerializedItemStatus.InStock);

    return ledgerQty === inStockCount;
  }

  private async dispatchEvents(item: SerializedItem): Promise<void> {
    await DomainEventDispatcher.dispatch(item.releaseEvents());
  }
}
