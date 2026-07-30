import { Logger } from "../logging/logger";

interface CacheEntry {
  value: any;
  expiresAt: number;
}

export class RedisCacheService {
  private static instance: RedisCacheService;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private hits: number = 0;
  private misses: number = 0;
  private invalidations: number = 0;

  private constructor() {}

  public static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }

  public get<T = any>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value as T;
  }

  public set(key: string, value: any, ttlSeconds: number = 300): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.memoryCache.set(key, { value, expiresAt });
  }

  public invalidatePattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        count++;
      }
    }
    this.invalidations += count;
    Logger.info({ context: "RedisCacheService", message: `Invalidated ${count} cache keys matching pattern: ${pattern}` });
    return count;
  }

  public flush(tenantId?: string): number {
    if (!tenantId) {
      const count = this.memoryCache.size;
      this.memoryCache.clear();
      this.invalidations += count;
      return count;
    }
    return this.invalidatePattern(`*${tenantId}*`);
  }

  public getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRatio = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio: Number(hitRatio.toFixed(2)),
      invalidations: this.invalidations,
      activeKeysCount: this.memoryCache.size
    };
  }
}
