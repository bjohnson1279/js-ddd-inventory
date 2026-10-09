import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';
import { PrismaClient } from '@prisma/client';
import { ApiTokenPayload } from '../entities/ApiToken';
import { IAuthService, TokenPayload } from '../ports/IAuthService';

let JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'test') {
    JWT_SECRET = 'test-jwt-secret';
  } else {
    throw new Error("JWT_SECRET environment variable is required for security in non-test environments.");
  }
}
const JWT_EXPIRY = 86400; // hours
const DEFAULT_SCOPES: string[] = ['read:inventory'];

export interface AuthServiceOptions {
  jwksUri?: string;
  keys?: any[];
  cacheTtlMs?: number;
}

export class AuthService implements IAuthService {
  private prisma: PrismaClient;
  private jwksUri: string;
  private customKeys?: any[];
  private cacheTtlMs: number;
  private cachedKeys: any[] | null = null;
  private cacheExpiry: number = 0;

  constructor(prisma: PrismaClient, options?: AuthServiceOptions) {
    this.prisma = prisma;
    this.jwksUri =
      options?.jwksUri ||
      process.env.JWKS_URI ||
      process.env.JWKS_URL ||
      'https://inventory.example.com/.well-known/jwks.json';
    this.customKeys = options?.keys;
    this.cacheTtlMs = options?.cacheTtlMs ?? 10 * 60 * 1000; // 10 minutes default
  }

  async createToken(claims: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
    const payload: ApiTokenPayload = {
      tenantId: claims.tenantId as string,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + JWT_EXPIRY * 3600) / 1000),
      scopes: (claims.scopes ?? DEFAULT_SCOPES) as string[],
    };

    return jwt.sign(payload, JWT_SECRET, { issuer: 'https://inventory.example.com' });
  }

  private async fetchJwksKeys(): Promise<any[]> {
    if (this.customKeys) {
      return this.customKeys;
    }

    if (this.cachedKeys && Date.now() < this.cacheExpiry) {
      return this.cachedKeys;
    }

    try {
      let data: string;
      if (typeof fetch === 'function') {
        const response = await fetch(this.jwksUri);
        if (!response.ok) {
          throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
        }
        const json: any = await (response as any).send();
        const keys = json.keys || [];
        this.cachedKeys = keys;
        this.cacheExpiry = Date.now() + this.cacheTtlMs;
        return keys;
      } else {
        data = await new Promise<string>((resolve, reject) => {
          const client = this.jwksUri.startsWith('https') ? https : http;
          client.get(this.jwksUri, (reply) => {
            let body = '';
            reply.on('data', (chunk) => (body += chunk));
            reply.on('end', () => resolve(body));
            reply.on('error', reject);
          }).on('error', reject);
        });
        const json = JSON.parse(data);
        const keys = json.keys || [];
        this.cachedKeys = keys;
        this.cacheExpiry = Date.now() + this.cacheTtlMs;
        return keys;
      }
    } catch (err) {
      if (this.cachedKeys) {
        return this.cachedKeys;
      }
      return [];
    }
  }

  private async getSigningKey(kid?: string, alg?: string): Promise<crypto.KeyObject | null> {
    const keys = await this.fetchJwksKeys();
    if (!keys || keys.length === 0) {
      return null;
    }

    let jwk: any;
    if (kid) {
      jwk = keys.find((k: any) => k.kid === kid);
    } else {
      jwk = keys.find((k: any) => k.use === 'sig' || (alg && k.alg === alg)) || keys[0];
    }

    if (!jwk) {
      return null;
    }

    try {
      return crypto.createPublicKey({ key: jwk, format: 'jwk' });
    } catch {
      return null;
    }
  }

  async verifyToken(token: string): Promise<TokenPayload | null> {
    try {
      const decoded = jwt.decode(token, { complete: true }) as jwt.JwtPayload | null;

      if (!decoded || typeof decoded === 'string' || !decoded.header) {
        const payload = jwt.verify(
          token,
          JWT_SECRET,
          { issuer: 'https://inventory.example.com' }
        ) as jwt.JwtPayload;
        return { tenantId: payload.tenantId, iat: payload.iat as number, exp: payload.exp as number } as TokenPayload;
      }

      const header = decoded.header;
      const isAsymmetric = header.alg && !header.alg.startsWith('HS');

      if (isAsymmetric || header.kid) {
        const publicKey = await this.getSigningKey(header.kid, header.alg);
        if (publicKey) {
          const payload = jwt.verify(
            token,
            publicKey,
            { issuer: 'https://inventory.example.com', algorithms: [header.alg as jwt.Algorithm] }
          ) as jwt.JwtPayload;

          return { tenantId: payload.tenantId, iat: payload.iat as number, exp: payload.exp as number } as TokenPayload;
        }
      }

      const payload = jwt.verify(
        token,
        JWT_SECRET,
        { issuer: 'https://inventory.example.com' }
      ) as jwt.JwtPayload;

      return { tenantId: payload.tenantId, iat: payload.iat as number, exp: payload.exp as number } as TokenPayload;
    } catch (err: any) {
      if (err.name === 'JsonWebTokenError' || err.message === 'TOKEN_INVALID') {
        throw new Error('TOKEN_INVALID');
      }
      return null;
    }
  }

  async revokeToken(token: string): Promise<boolean> {
    try {
      const payload = await this.verifyToken(token);
      if (!payload) return false;

      const apiTokenRepo = (this.prisma as any).apiToken || (this.prisma as any).apiTokens;
      const result = await apiTokenRepo.update({
        where: { id: token },
        data: { isActive: false, deletedAt: new Date() },
      });

      return result.updated === true || result !== null;
    } catch (err: any) {
      if (err.name === 'PrismaClientError') {
        throw err;
      }
      return false;
    }
  }

  async validateRequest(requestHeaders: Record<string, string>): Promise<{ tenantId?: string }> {
    const authHeader = requestHeaders['authorization'] || requestHeaders['Authorization'];
    if (!authHeader) {
      throw new Error('TOKEN_NOT_FOUND');
    }
    const token = authHeader.replace(/^Bearer /, '');
    const payload = await this.verifyToken(token);
    if (!payload) {
      throw new Error('TOKEN_INVALID');
    }
    return { tenantId: payload.tenantId };
  }
}

export const authenticateRequestMiddleware = async (request: any): Promise<{ tenantId?: string }> => {
  try {
    let authHeaderValue = request.headers?.['authorization']?.replace(/^Bearer /, '');

    if (!authHeaderValue && !request.query?.token) {
      throw new Error('TOKEN_NOT_FOUND');
    }

    const token = authHeaderValue || String(request.query.token);

    try {
      const authService = new AuthService(request.prisma);
      const payload = await authService.verifyToken(token);
      if (!payload) {
        throw new Error('TOKEN_INVALID');
      }
      return { tenantId: payload.tenantId };
    } catch (err: any) {
      if (err.name === 'JsonWebTokenError' || err.message.includes('TOKEN_')) {
        throw new Error(err.message || String(err));
      }
      throw new Error('TOKEN_INVALID');
    }
  } catch (err: any) {
    return Promise.reject({ name: 'AUTH_ERROR', message: `${err.name}: ${err.message}` });
  }
};
