import { ShopifyWebhookSecurity } from '../../../src/infrastructure/shopify/ShopifyWebhookSecurity';
import * as crypto from 'crypto';

describe('ShopifyWebhookSecurity', () => {
  const secret = 'my_super_secret_key';
  let security: ShopifyWebhookSecurity;

  beforeEach(() => {
    security = new ShopifyWebhookSecurity(secret);
  });

  it('should return true for a valid HMAC', () => {
    const body = JSON.stringify({ id: 123, title: 'Test Product' });
    const hmac = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');

    expect(security.validateHmac(body, hmac)).toBe(true);
  });

  it('should return false for an invalid HMAC', () => {
    const body = JSON.stringify({ id: 123, title: 'Test Product' });
    const invalidHmac = crypto.createHmac('sha256', secret).update('different body', 'utf8').digest('base64');

    expect(security.validateHmac(body, invalidHmac)).toBe(false);
  });

  it('should return false for an HMAC with an invalid length', () => {
    const body = JSON.stringify({ id: 123, title: 'Test Product' });
    const invalidLengthHmac = 'too-short';

    expect(security.validateHmac(body, invalidLengthHmac)).toBe(false);
  });
});
