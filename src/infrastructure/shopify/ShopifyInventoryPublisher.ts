import { IExternalInventoryPublisher } from "../../application/ports/IExternalInventoryPublisher";
import { SKU } from "../../domain/valueObjects/SKU";
import { Quantity } from "../../domain/valueObjects/Quantity";
import { ShopifyClient } from "./ShopifyClient";
import { Logger } from "../../infrastructure/logging/logger";

export class ShopifyInventoryPublisher implements IExternalInventoryPublisher {
  constructor(
    private readonly shopifyClient: ShopifyClient,
    private readonly locationId: string // The Shopify Location GID
  ) {}

  public async publishStockLevel(sku: SKU, quantity: Quantity): Promise<void> {
    // Note: In a real implementation, we would first need to look up the 
    // inventoryItemId by SKU if it's not cached/stored in our DB.
    // For this implementation, we assume we can find it or we use a mutation 
    // that might support SKU-based lookup if available, but usually Shopify 
    // requires the InventoryItem ID.
    
    // Simplified: Find inventory item by SKU first
    const findQuery = `
      query findInventoryItem($query: string) {
        inventoryItems(first: 1, query: $query) {
          edges {
            node {
              id
            }
          }
        }
      }
    `;

    const findData = await this.shopifyClient.query<any>(findQuery, {
      query: `sku:${sku.getValue()}`
    });

    const inventoryItemId = findData.inventoryItems.edges[0]?.node.id;

    if (!inventoryItemId) {
      Logger.warn({ context: "ShopifyInventoryPublisher", message: `Could not find Shopify inventory item for SKU: ${sku.getValue()}` });
      return;
    }

    const mutation = `
      mutation inventorySet($input: InventorySetOnHandQuantitiesInput!) {
        inventorySetOnHandQuantities(input: $input) {
          inventoryLevels {
            id
            quantities(names: ["on_hand"]) {
              quantity
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        reason: "correction",
        setQuantities: [
          {
            inventoryItemId: inventoryItemId,
            locationId: this.locationId,
            quantity: quantity.getValue()
          }
        ]
      }
    };

    const result = await this.shopifyClient.query<any>(mutation, variables);
    
    if (result.inventorySetOnHandQuantities.userErrors.length > 0) {
      throw new Error(`Shopify mutation errors: ${JSON.stringify(result.inventorySetOnHandQuantities.userErrors)}`);
    }
  }
}
