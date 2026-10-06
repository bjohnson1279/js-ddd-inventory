import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { ApiTokenPayload } from '../entities/ApiToken';
import { IAuthService, TokenPayload } from '../ports/IAuthService';

export interface JWK {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  [key: string]: unknown;
}

export interface JWKS {
  keys: JWK[];
}

const envSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret' : undefined);
if (!envSecret) {
  throw new Error('JWT_SECRET environment variable is required for security.');
}
const JWT_SECRET: string = envSecret;
const JWT_EXPIRY = 86400; // hours
const DEFAULT_SCOPES: string[] = ['read:inventory'];

export class AuthService implements IAuthService {
  private prisma: PrismaClient;
  private jwks?: JWKS;

  constructor(prisma: PrismaClient, jwks?: JWKS) {
    this.prisma = prisma;
    this.jwks = jwks;
  }

  setJWKS(jwks: JWKS) {
    this.jwks = jwks;
  }

  async createToken(claims: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
    const payload: ApiTokenPayload = {
      tenantId: claims.tenantId as string,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + JWT_EXPIRY * 3600) / 1000),
      scopes: (claims.scopes as string[]) ?? DEFAULT_SCOPES,
    };

    return jwt.sign(payload, JWT_SECRET, { issuer: 'https://inventory.example.com' });
  }

  private getKeyFromJWKS(kid?: string): string | null {
    if (!this.jwks || !this.jwks.keys || this.jwks.keys.length === 0) {
      return null;
    }
    const matchingKey = kid
      ? this.jwks.keys.find((k) => k.kid === kid)
      : this.jwks.keys[0];

    if (!matchingKey) return null;

    try {
      const keyObj = crypto.createPublicKey({ key: matchingKey as any, format: 'jwk' });
      return keyObj.export({ type: 'spki', format: 'pem' }) as string;
    } catch {
      return null;
    }
  }

  async verifyToken(token: string): Promise<TokenPayload | null> {
    try {
      let secretOrKey: string = JWT_SECRET;

      if (this.jwks) {
        const decodedHeader = jwt.decode(token, { complete: true })?.header;
        const pemKey = this.getKeyFromJWKS(decodedHeader?.kid);
        if (pemKey) {
          secretOrKey = pemKey;
        }
      }

      const payload = jwt.verify(
        token,
        secretOrKey,
        { issuer: 'https://inventory.example.com' }
      ) as jwt.JwtPayload;

      return { tenantId: payload.tenantId, iat: payload.iat as number, exp: payload.exp as number } as TokenPayload;
    } catch (err: any) {
      if (err.name === 'JsonWebTokenError') {
        throw new Error('TOKEN_INVALID');
      }
      return null;
    }
  }

  async revokeToken(token: string): Promise<boolean> {
    try {
      const payload = await this.verifyToken(token);
      if (!payload) return false;

      const result = await this.prisma.apiToken.update({
        where: { id: token },
        data: { isActive: false },
      });

      return Boolean(result);
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