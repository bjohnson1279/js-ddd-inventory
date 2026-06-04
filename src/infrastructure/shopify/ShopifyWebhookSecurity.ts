import * as crypto from 'crypto';

export class ShopifyWebhookSecurity {
  constructor(private readonly apiSecret: string) {}

  public validateHmac(body: string, hmac: string): boolean {
    const hash = crypto
      .createHmac('sha256', this.apiSecret)
      .update(body, 'utf8')
      .digest('base64');
    
    const hashBuffer = Buffer.from(hash, 'utf8');
    const hmacBuffer = Buffer.from(hmac, 'utf8');

    // Use timingSafeEqual to prevent timing attacks.
    // Lengths must match before comparing, otherwise timingSafeEqual throws.
    if (hashBuffer.length !== hmacBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuffer, hmacBuffer);
  }
}
