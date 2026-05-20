import { Quantity } from "../../domain/valueObjects/Quantity";
import { SKU } from "../../domain/valueObjects/SKU";

export interface IExternalInventoryPublisher {
  publishStockLevel(sku: SKU, quantity: Quantity): Promise<void>;
}
