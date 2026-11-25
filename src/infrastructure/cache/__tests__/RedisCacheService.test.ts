import { RedisCacheService } from '../RedisCacheService';

describe('RedisCacheService', () => {
  const cache = RedisCacheService.getInstance();

  beforeEach(() => {
    cache.flush();
    jest.restoreAllMocks();
  });

  it('returns the same singleton instance', () => {
    expect(RedisCacheService.getInstance()).toBe(cache);
  });

  it('stores values, tracks hits/misses, and expires entries past TTL', () => {
    const startStats = cache.getStats();
    expect(cache.get('missing-key')).toBeNull();
    expect(cache.getStats().misses).toBe(startStats.misses + 1);

    cache.set('stock:t1:SKU-1', { qty: 10 }, 60);
    expect(cache.get<{ qty: number }>('stock:t1:SKU-1')).toEqual({ qty: 10 });
    expect(cache.getStats().hits).toBe(startStats.hits + 1);
    expect(cache.getStats().hitRatio).toBeGreaterThan(0);

    // Simulate TTL expiration
    const future = Date.now() + 120_000;
    jest.spyOn(Date, 'now').mockReturnValue(future);
    expect(cache.get('stock:t1:SKU-1')).toBeNull();
  });

  it('invalidates keys by wildcard pattern and flushes by tenant or globally', () => {
    cache.set('stock:tenant-a:SKU-1', 1);
    cache.set('stock:tenant-a:SKU-2', 2);
    cache.set('stock:tenant-b:SKU-1', 3);

    const removedA = cache.invalidatePattern('stock:tenant-a:*');
    expect(removedA).toBe(2);
    expect(cache.get('stock:tenant-a:SKU-1')).toBeNull();
    expect(cache.get('stock:tenant-b:SKU-1')).toBe(3);

    cache.set('other:tenant-b:val', 4);
    const flushedB = cache.flush('tenant-b');
    expect(flushedB).toBe(2);
    expect(cache.getStats().activeKeysCount).toBe(0);

    cache.set('global:key', 99);
    expect(cache.flush()).toBe(1);
    expect(cache.getStats().activeKeysCount).toBe(0);
  });
});
