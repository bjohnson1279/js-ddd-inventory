import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { ApiUsageMetricRepository } from '../../database/ApiUsageMetricRepository';
import { Logger } from '../../logging/logger';

// In-memory token bucket rate limiter per tenant
// We are using a basic implementation for demonstration purposes.
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets: Record<string, TokenBucket> = {};
const BUCKET_CAPACITY = parseInt(process.env.TENANT_RATE_LIMIT_CAPACITY || '100');
const BUCKET_REFILL_RATE = parseInt(process.env.TENANT_RATE_LIMIT_REFILL_RATE || '10'); // tokens per second
const REFILL_INTERVAL_MS = 1000;

const usageRepo = new ApiUsageMetricRepository();

export const platformThrottlingMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.tenantId;

  // If no tenantId is present (e.g. public endpoint), we can fall back to standard IP-based rate limiting,
  // but for tenant-level throttling, we skip if tenantId is missing.
  if (!tenantId) {
    return next();
  }

  const now = Date.now();
  
  if (!buckets[tenantId]) {
    buckets[tenantId] = {
      tokens: BUCKET_CAPACITY,
      lastRefill: now,
    };
  }

  const bucket = buckets[tenantId];
  
  // Refill tokens based on time elapsed
  const elapsedTime = now - bucket.lastRefill;
  if (elapsedTime > REFILL_INTERVAL_MS) {
    const tokensToAdd = Math.floor(elapsedTime / REFILL_INTERVAL_MS) * BUCKET_REFILL_RATE;
    bucket.tokens = Math.min(BUCKET_CAPACITY, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    
    // Asynchronously log the usage metric so we don't block the request
    const endpoint = req.route ? req.route.path : req.path;
    usageRepo.incrementUsage(tenantId, endpoint).catch((err) => {
      Logger.error({ context: 'platformThrottling', message: `Failed to increment usage for ${tenantId}: ${err.message}` });
    });

    next();
  } else {
    // Bucket is empty, rate limit the request
    Logger.warn({ context: 'platformThrottling', message: `Tenant ${tenantId} exceeded API rate limit.` });
    res.status(429).json({ error: 'Too Many Requests', message: 'API rate limit exceeded. Please try again later.' });
  }
};
