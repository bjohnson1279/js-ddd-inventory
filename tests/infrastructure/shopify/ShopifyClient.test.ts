import { ShopifyClient } from "../../../src/infrastructure/shopify/ShopifyClient";

describe("ShopifyClient", () => {
  let originalFetch: any;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("should make a successful POST request and return data", async () => {
    const mockData = { data: { inventoryItems: { edges: [] } } };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockData)
    });

    const client = new ShopifyClient("test.myshopify.com", "token123");
    const result = await client.query<any>("query { test }");

    expect(result).toEqual({ inventoryItems: { edges: [] } });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://test.myshopify.com/admin/api/2024-04/graphql.json",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": "token123"
        },
        body: JSON.stringify({ query: "query { test }", variables: undefined })
      })
    );
  });

  it("should throw an error on non-ok network response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue("Internal Server Error")
    });

    const client = new ShopifyClient("test.myshopify.com", "token123");
    await expect(client.query("query { test }")).rejects.toThrow("Shopify API error (500): Internal Server Error");
  });

  it("should throw an error if GraphQL response has errors", async () => {
    const mockResponse = {
      errors: [{ message: "Unauthorized access" }]
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse)
    });

    const client = new ShopifyClient("test.myshopify.com", "token123");
    await expect(client.query("query { test }")).rejects.toThrow("Shopify GraphQL errors: ");
  });
});
