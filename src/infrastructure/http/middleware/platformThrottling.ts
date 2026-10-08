import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from './auth';
import { ApiUsageMetricRepository } from '../../database/ApiUsageMetricRepository';
import { Logger } from '../../logging/logger';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets: Record<string, TokenBucket> = {};
const BUCKET_CAPACITY = parseInt(process.env.TENANT_RATE_LIMIT_CAPACITY || '100');
const BUCKET_REFILL_RATE = parseInt(process.env.TENANT_RATE_LIMIT_REFILL_RATE || '10'); // tokens per second
const REFILL_INTERVAL_MS = 1000;

const usageRepo = new ApiUsageMetricRepository();

export const platformThrottlingMiddleware = async (request: any, reply: any) => {
  const authReq = request as AuthenticatedRequest;
  const tenantId = authReq.tenantId;

  if (process.env.NODE_ENV === "test") return;
  if (!tenantId) return;

  const now = Date.now();
  
  if (!buckets[tenantId]) {
    buckets[tenantId] = {
      tokens: BUCKET_CAPACITY,
      lastRefill: now,
    };
  }

  const bucket = buckets[tenantId];
  
  const elapsedTime = now - bucket.lastRefill;
  if (elapsedTime > REFILL_INTERVAL_MS) {
    const tokensToAdd = Math.floor(elapsedTime / REFILL_INTERVAL_MS) * BUCKET_REFILL_RATE;
    bucket.tokens = Math.min(BUCKET_CAPACITY, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    
    const endpoint = request.routeOptions ? request.routeOptions.url : request.url;
    usageRepo.incrementUsage(tenantId, endpoint).catch((err) => {
      Logger.error({ context: 'platformThrottling', message: `Failed to increment usage for ${tenantId}: ${err.message}` });
    });

    return;
  } else {
    Logger.warn({ context: 'platformThrottling', message: `Tenant ${tenantId} exceeded API rate limit.` });
    reply.status(429).send({ error: 'Too Many Requests', message: 'API rate limit exceeded. Please try again later.' });
    return reply;
  }
};
