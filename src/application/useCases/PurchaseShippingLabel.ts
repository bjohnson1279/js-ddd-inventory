import { IShipmentRepository } from "../../domain/repositories/IShipmentRepository";
import { ICarrierService } from "../ports/ICarrierService";
import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { IDispatchRecordRepository, DispatchRecord } from "../../domain/repositories/IDispatchRecordRepository";
import { ITenantConfigRepository } from "../../domain/repositories/ITenantConfigRepository";
import { IJournalRepository } from "../../domain/repositories/IJournalRepository";
import { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import { Shipment } from "../../domain/shipping/aggregates/Shipment";
import { ShipmentStatus } from "../../domain/shipping/enums/ShipmentStatus";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { JournalEntry } from "../../domain/accounting/aggregates/JournalEntry";
import { DebitCredit } from "../../domain/accounting/enums/DebitCredit";
import { AccountCode } from "../../domain/accounting/valueObjects/AccountCode";
import { AccountCategory } from "../../domain/accounting/enums/AccountCategory";
import { AccountingMethod } from "../../domain/accounting/enums/AccountingMethod";

export interface PurchaseShippingLabelCommand {
  sku: string;
  quantity: number;
  destinationAddress: string;
  carrier: string;
  locationId: string;
  tenantId: string;
}

export interface PurchaseShippingLabelResult {
  shipmentId: string;
  trackingNumber: string;
  labelUrl: string;
  rateCents: number;
}

export class PurchaseShippingLabel {
  constructor(
    private readonly shipmentRepository: IShipmentRepository,
    private readonly carrierService: ICarrierService,
    private readonly inventoryRepository: IInventoryRepository,
    private readonly dispatchRecordRepository: IDispatchRecordRepository,
    private readonly tenantConfigRepository: ITenantConfigRepository,
    private readonly journalRepository: IJournalRepository,
    private readonly outboxRepository: IOutboxRepository
  ) {}

  async execute(command: PurchaseShippingLabelCommand): Promise<PurchaseShippingLabelResult> {
    const { sku, quantity, destinationAddress, carrier, locationId, tenantId } = command;

    if (!sku || !quantity || !destinationAddress || !carrier || !locationId || !tenantId) {
      throw new Error("Missing required parameters for shipping label purchase.");
    }

    // 1. Validate stock level
    const skuVO = SKU.create(sku);
    const quantityVO = Quantity.create(quantity);
    const inventoryItem = await this.inventoryRepository.findBySku(skuVO, locationId);

    if (!inventoryItem) {
      throw new Error(`Inventory item not found for SKU ${sku} at location ${locationId}.`);
    }

    if (inventoryItem.quantity.getValue() < quantity) {
      throw new Error(`Insufficient stock for SKU ${sku}. On-hand: ${inventoryItem.quantity.getValue()}, Requested: ${quantity}`);
    }

    // 2. Generate carrier label
    const labelResult = await this.carrierService.generateLabel(sku, quantity, destinationAddress, carrier);

    // 3. Dispatch stock
    inventoryItem.dispatchStock(quantityVO);
    await this.inventoryRepository.save(inventoryItem);

    // 4. Log historical dispatch record
    await this.dispatchRecordRepository.save(
      new DispatchRecord("", sku, locationId, quantity, new Date())
    );

    // 5. Create Shipment record
    const shipmentId = Math.random().toString(36).substring(2, 11);
    const shipment = new Shipment(
      shipmentId,
      sku,
      quantity,
      destinationAddress,
      carrier,
      labelResult.trackingNumber,
      labelResult.labelUrl,
      labelResult.rateCents,
      ShipmentStatus.LABEL_GENERATED,
      new Date(),
      new Date()
    );
    await this.shipmentRepository.save(shipment);

    // 6. Generate double-entry ledger listings
    const config = await this.tenantConfigRepository.findByTenantId(tenantId);
    if (config) {
      const isAccrual = config.accountingMethod === AccountingMethod.Accrual || (config.accountingMethod as any) === "accrual";
      const method = isAccrual ? AccountingMethod.Accrual : AccountingMethod.Cash;
      
      const entryId = Math.random().toString(36).substring(2, 11);
      const entry = new JournalEntry(
        entryId,
        tenantId,
        new Date(),
        `Shipping carrier label purchased: ${carrier} ${labelResult.trackingNumber}`,
        shipmentId,
        method
      );

      const freightExpense = new AccountCode("5400", "Shipping & Freight Expense", AccountCategory.Expense);
      const freightLiability = new AccountCode("2100", "Accrued Shipping Liabilities", AccountCategory.Liability);
      const cashAccount = AccountCode.cash();

      if (isAccrual) {
        entry.addLine(freightExpense, labelResult.rateCents, DebitCredit.Debit, "Carrier shipping expense");
        entry.addLine(freightLiability, labelResult.rateCents, DebitCredit.Credit, "Accrued carrier liabilities");
      } else {
        // Cash accounting method clears liability immediately with cash
        entry.addLine(freightExpense, labelResult.rateCents, DebitCredit.Debit, "Carrier shipping expense");
        entry.addLine(cashAccount, labelResult.rateCents, DebitCredit.Credit, "Shipping paid immediately via Cash");
      }

      entry.assertBalanced();
      await this.journalRepository.save(entry);
    }

    // 7. Write outbox event
    await this.outboxRepository.save({
      occurredOn: new Date(),
      eventName: "ShipmentCreatedEvent",
      shipmentId,
      sku,
      quantity,
      carrier,
      trackingNumber: labelResult.trackingNumber,
      rateCents: labelResult.rateCents
    });

    return {
      shipmentId,
      trackingNumber: labelResult.trackingNumber,
      labelUrl: labelResult.labelUrl,
      rateCents: labelResult.rateCents
    };
  }
}
