import { ShopifyInventoryPublisher } from "../../../src/infrastructure/shopify/ShopifyInventoryPublisher";
import { SKU } from "../../../src/domain/valueObjects/SKU";
import { Quantity } from "../../../src/domain/valueObjects/Quantity";

describe("ShopifyInventoryPublisher", () => {
  it("should lookup the inventoryItemId by SKU and publish the set quantities mutation successfully", async () => {
    const mockClient = {
      query: jest.fn()
    } as any;

    mockClient.query
      .mockResolvedValueOnce({
        inventoryItems: {
          edges: [
            {
              node: {
                id: "gid://shopify/InventoryItem/12345"
              }
            }
          ]
        }
      })
      .mockResolvedValueOnce({
        inventorySetOnHandQuantities: {
          inventoryLevels: [
            {
              id: "level-123",
              quantities: [{ quantity: 15 }]
            }
          ],
          userErrors: []
        }
      });

    const publisher = new ShopifyInventoryPublisher(mockClient, "gid://shopify/Location/67890");
    await publisher.publishStockLevel(SKU.create("SKU-PROD"), Quantity.create(15));

    expect(mockClient.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("query findInventoryItem"),
      { query: "sku:SKU-PROD" }
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("mutation inventorySet"),
      expect.objectContaining({
        input: expect.objectContaining({
          setQuantities: [
            {
              inventoryItemId: "gid://shopify/InventoryItem/12345",
              locationId: "gid://shopify/Location/67890",
              quantity: 15
            }
          ]
        })
      })
    );
  });

  it("should warn and return early if inventory item ID is not found", async () => {
    const mockClient = {
      query: jest.fn().mockResolvedValue({
        inventoryItems: { edges: [] }
      })
    } as any;

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const publisher = new ShopifyInventoryPublisher(mockClient, "gid://shopify/Location/67890");
    await publisher.publishStockLevel(SKU.create("SKU-PROD"), Quantity.create(15));

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Could not find Shopify inventory item"));
    expect(mockClient.query).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it("should throw an error on mutation userErrors", async () => {
    const mockClient = {
      query: jest.fn()
    } as any;

    mockClient.query
      .mockResolvedValueOnce({
        inventoryItems: {
          edges: [{ node: { id: "gid://shopify/InventoryItem/12345" } }]
        }
      })
      .mockResolvedValueOnce({
        inventorySetOnHandQuantities: {
          inventoryLevels: [],
          userErrors: [{ field: ["quantity"], message: "Invalid quantity provided" }]
        }
      });

    const publisher = new ShopifyInventoryPublisher(mockClient, "gid://shopify/Location/67890");
    await expect(publisher.publishStockLevel(SKU.create("SKU-PROD"), Quantity.create(15))).rejects.toThrow("Shopify mutation errors:");
  });
});
