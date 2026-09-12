import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { IApiTokenEntity, ApiTokenPayload } from '../entities/ApiToken';
import { IAuthService, TokenPayload } from '../ports/IAuthService';

const JWT_SECRET = process.env.JWT_SECRET || 'production-jwt-secret-change-me';
const JWT_EXPIRY = 86400; // hours
const DEFAULT_SCOPES: string[] = ['read:inventory'];

export class AuthService implements IAuthService {
  private prisma: PrismaClient;
  private tokenIssuer: jwt.SignatureProvider = (payload) =>
    jwt.sign(payload, JWT_SECRET);
  private tokenVerifier: jwt.VerifyOptions['verify'] = () => true; // TODO: add JWKS support

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createToken(claims: Omit<TokenPayload, 'iat' | 'exp'>): string {
    const payload: ApiTokenPayload = {
      tenantId: claims.tenantId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + JWT_EXPIRY * 3600) / 1000),
      scopes: claims.scopes ?? DEFAULT_SCOPES,
    };

    return this.tokenIssuer(payload);
  }

  async verifyToken(token: string): TokenPayload | null {
    try {
      const payload = await jwt.verify(
        token,
        JWT_SECRET,
        this.tokenVerifier,
        { issuer: 'https://inventory.example.com' }, // TODO: add JWKS support
      );

      return { tenantId: payload.tenantId, iat: payload.iat as number, exp: payload.exp as number } as TokenPayload;
    } catch (err) {
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

      const result = await this.prisma.apiTokens.update({
        where: { id: token },
        data: { isActive: false, deletedAt: new Date() },
      });

      return result.updated === true;
    } catch (err) {
      if (err.name === 'PrismaClientError') {
        throw err;
      }
      return false;
    }
  }
}

export const authenticateRequestMiddleware = async (req: Express.Request): Promise<{ tenantId?: string }> => {
  try {
    // Check for Authorization header (Bearer token) or Query parameter (?token=...)
    let authHeaderValue = req.headers['authorization']?.replace(/^Bearer /, '');

    if (!authHeaderValue && !req.query.token) {
      throw new Error('TOKEN_NOT_FOUND');
    }

    const token = authHeaderValue || String(req.query.token);

    // Verify the token and extract tenantId
    try {
      await this.authService.verifyToken(token)!; // throws error if invalid/expired
      return { tenantId: (await this.authService.verifyToken(token))!.tenantId };
    } catch (err) {
      if (err.name === 'JsonWebTokenError' || err.message.includes('TOKEN_')) {
        throw new Error(err as string); // re-throw with auth error code
      }
      throw new Error('TOKEN_INVALID');
    }
  } catch (err) {
    return Promise.reject({ name: 'AUTH_ERROR', message: `${err.name}: ${err.message}` });
  }
};