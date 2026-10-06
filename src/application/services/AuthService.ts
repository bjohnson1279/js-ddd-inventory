import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { ApiTokenPayload } from '../entities/ApiToken';
import { IAuthService, TokenPayload } from '../ports/IAuthService';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret' : undefined);
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for security.');
}
const JWT_EXPIRY = 86400; // hours
const DEFAULT_SCOPES: string[] = ['read:inventory'];

export interface JwksKey {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  [key: string]: unknown;
}

export interface AuthServiceOptions {
  jwksKeys?: JwksKey[];
  jwksUri?: string;
}

export class AuthService implements IAuthService {
  private prisma: PrismaClient;
  private jwksKeys: JwksKey[];
  private jwksUri?: string;
  private tokenIssuer: (payload: ApiTokenPayload) => string = (payload) =>
    jwt.sign(payload, JWT_SECRET as string);

  constructor(prisma: PrismaClient, options?: AuthServiceOptions) {
    this.prisma = prisma;
    this.jwksKeys = options?.jwksKeys || [];
    this.jwksUri = options?.jwksUri;
  }

  async createToken(claims: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
    const payload: ApiTokenPayload = {
      tenantId: claims.tenantId as string,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + JWT_EXPIRY * 3600) / 1000),
      scopes: (claims.scopes as string[]) ?? DEFAULT_SCOPES,
    };

    return this.tokenIssuer(payload);
  }

  async verifyToken(token: string): Promise<TokenPayload | null> {
    try {
      const decodedHeader = jwt.decode(token, { complete: true }) as { header?: { kid?: string; alg?: string } } | null;
      let verificationSecretOrKey: string = JWT_SECRET as string;

      if (decodedHeader?.header?.kid) {
        const matchingKey = this.jwksKeys.find((key) => key.kid === decodedHeader.header?.kid);
        if (matchingKey) {
          const publicKey = crypto.createPublicKey({ key: matchingKey as crypto.JsonWebKey, format: 'jwk' });
          verificationSecretOrKey = publicKey.export({ format: 'pem', type: 'spki' }).toString();
        } else if (this.jwksKeys.length > 0) {
          throw new Error('TOKEN_INVALID');
        }
      }

      const payload = jwt.verify(
        token,
        verificationSecretOrKey,
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

      const result = await this.prisma.apiToken.update({
        where: { id: token },
        data: { isActive: false },
      });

      return result.isActive === false;
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

export const authenticateRequestMiddleware = async (req: any): Promise<{ tenantId?: string }> => {
  try {
    let authHeaderValue = req.headers?.['authorization']?.replace(/^Bearer /, '');

    if (!authHeaderValue && !req.query?.token) {
      throw new Error('TOKEN_NOT_FOUND');
    }

    const token = authHeaderValue || String(req.query.token);

    try {
      const authService: AuthService = (req as any).authService;
      if (!authService) {
        throw new Error('TOKEN_INVALID');
      }
      const verifiedPayload = await authService.verifyToken(token);
      if (!verifiedPayload) {
        throw new Error('TOKEN_INVALID');
      }
      return { tenantId: verifiedPayload.tenantId };
    } catch (err: any) {
      if (err.name === 'JsonWebTokenError' || (err.message && err.message.includes('TOKEN_'))) {
        throw new Error(err.message || String(err));
      }
      throw new Error('TOKEN_INVALID');
    }
  } catch (err: any) {
    return Promise.reject({ name: 'AUTH_ERROR', message: `${err.name}: ${err.message}` });
  }
};
