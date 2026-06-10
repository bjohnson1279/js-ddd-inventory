export class ShopifyClient {
  private readonly shopUrl: string;
  private readonly accessToken: string;
  private readonly apiVersion = '2024-04';

  constructor(shopUrl: string, accessToken: string) {
    this.shopUrl = shopUrl;
    this.accessToken = accessToken;
  }

  private get graphqlUrl(): string {
    return `https://${this.shopUrl}/admin/api/${this.apiVersion}/graphql.json`;
  }

  public async query<T>(query: string, variables?: any): Promise<T> {
    const response = await fetch(this.graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API error (${response.status}): ${errorText}`);
    }

    const json = await response.json() as any;
    if (json.errors) {
      throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
    }

    return json.data as T;
  }
}
