import { RedisCacheService } from "../../../src/infrastructure/cache/RedisCacheService";

describe("RedisCacheService", () => {
  let cache: RedisCacheService;

  beforeEach(() => {
    cache = RedisCacheService.getInstance();
    cache.flush();
  });

  it("should return singleton instance", () => {
    const instance1 = RedisCacheService.getInstance();
    const instance2 = RedisCacheService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("should set and get typed values correctly", () => {
    interface TestData {
      id: string;
      count: number;
    }
    const data: TestData = { id: "item-1", count: 42 };

    cache.set<TestData>("test-key", data, 60);
    const retrieved = cache.get<TestData>("test-key");

    expect(retrieved).toEqual(data);
    expect(retrieved?.id).toBe("item-1");
    expect(retrieved?.count).toBe(42);
  });

  it("should return null and record a miss for non-existent key", () => {
    const initialMisses = cache.getStats().misses;
    const result = cache.get("non-existent");
    expect(result).toBeNull();

    const stats = cache.getStats();
    expect(stats.misses).toBe(initialMisses + 1);
  });

  it("should return null and record a miss for expired keys", () => {
    jest.useFakeTimers();
    try {
      const initialMisses = cache.getStats().misses;
      const initialHits = cache.getStats().hits;

      cache.set("expire-key", "some-value", 10); // 10 seconds TTL
      expect(cache.get<string>("expire-key")).toBe("some-value");

      // Advance time past TTL
      jest.advanceTimersByTime(11 * 1000);

      expect(cache.get<string>("expire-key")).toBeNull();
      const stats = cache.getStats();
      expect(stats.misses).toBe(initialMisses + 1);
      expect(stats.hits).toBe(initialHits + 1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("should correctly invalidate keys matching a pattern", () => {
    cache.set("tenant:1:item:1", { name: "A" });
    cache.set("tenant:1:item:2", { name: "B" });
    cache.set("tenant:2:item:1", { name: "C" });

    const invalidated = cache.invalidatePattern("*tenant:1*");
    expect(invalidated).toBe(2);

    expect(cache.get("tenant:1:item:1")).toBeNull();
    expect(cache.get("tenant:1:item:2")).toBeNull();
    expect(cache.get("tenant:2:item:1")).toEqual({ name: "C" });
  });

  it("should flush all keys when no tenantId is provided", () => {
    cache.set("k1", 1);
    cache.set("k2", 2);

    const count = cache.flush();
    expect(count).toBe(2);
    expect(cache.get("k1")).toBeNull();
    expect(cache.get("k2")).toBeNull();
  });

  it("should flush keys matching tenantId when provided", () => {
    cache.set("tenant-alpha:user:1", "user1");
    cache.set("tenant-beta:user:2", "user2");

    const count = cache.flush("tenant-alpha");
    expect(count).toBe(1);
    expect(cache.get("tenant-alpha:user:1")).toBeNull();
    expect(cache.get("tenant-beta:user:2")).toBe("user2");
  });

  it("should report accurate cache stats and hitRatio", () => {
    cache.set("stat-key", "stat-val");

    // 2 hits, 1 miss
    cache.get("stat-key");
    cache.get("stat-key");
    cache.get("stat-miss");

    const stats = cache.getStats();
    expect(stats.hits).toBeGreaterThanOrEqual(2);
    expect(stats.misses).toBeGreaterThanOrEqual(1);
    expect(stats.activeKeysCount).toBe(1);
    expect(typeof stats.hitRatio).toBe("number");
  });
});
