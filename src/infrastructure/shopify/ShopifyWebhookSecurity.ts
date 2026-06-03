import * as crypto from 'crypto';

export class ShopifyWebhookSecurity {
  constructor(private readonly apiSecret: string) {}

  public validateHmac(body: string, hmac: string): boolean {
    const hash = crypto
      .createHmac('sha256', this.apiSecret)
      .update(body, 'utf8')
      .digest('base64');
    
    return hash === hmac;
  }
}
