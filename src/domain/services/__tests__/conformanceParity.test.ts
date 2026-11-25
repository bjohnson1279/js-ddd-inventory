import { RedisCacheService } from '../../../infrastructure/cache/RedisCacheService';
import { SerialNumber } from '../../../domain/serial/valueObjects/SerialNumber';

describe('Express conformance parity unit tests', () => {
  test('RedisCacheService tracks misses, hits, pattern invalidations, and flush', () => {
    const cache = RedisCacheService.getInstance();
    cache.flush();
    const before = cache.getStats();

    expect(cache.get('stock:t1:SKU-1:default')).toBeNull();
    cache.set('stock:t1:SKU-1:default', { quantity: 10 }, 60);
    expect(cache.get('stock:t1:SKU-1:default')).toEqual({ quantity: 10 });

    const mid = cache.getStats();
    expect(mid.misses).toBe(before.misses + 1);
    expect(mid.hits).toBe(before.hits + 1);
    expect(mid.activeKeysCount).toBeGreaterThanOrEqual(1);

    const invalidated = cache.invalidatePattern('stock:*SKU-1*');
    expect(invalidated).toBeGreaterThanOrEqual(1);
    expect(cache.get('stock:t1:SKU-1:default')).toBeNull();
  });

  test('SerialNumber preserves case and rejects empty values', () => {
    const sn = new SerialNumber('SN-MixedCase-01');
    expect(sn.value).toBe('SN-MixedCase-01');
    expect(sn.equals(new SerialNumber('SN-MixedCase-01'))).toBe(true);
    expect(() => new SerialNumber('   ')).toThrow();
  });
});
