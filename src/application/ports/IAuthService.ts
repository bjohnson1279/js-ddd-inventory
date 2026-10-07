import { Prisma } from '@prisma/client';

export interface IApiTokenClaims extends Prisma.JsTokens.Payload {
  tenantId: string;
  scopes?: Array<string>;
}

export interface IAuthError extends Error {
  code: 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'TOKEN_NOT_FOUND' | 'TOKEN_REVOKED';
}

export interface TokenPayload {
  tenantId: string;
  iat: number;
  exp: number;
  scopes?: Array<string>;
  [key: string]: unknown;
}

export interface IAuthService {
  createToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> | string;
  verifyToken(token: string): Promise<TokenPayload | null> | TokenPayload | null;
  revokeToken(token: string): Promise<boolean> | boolean;
  validateRequest(requestHeaders: Record<string, string>): Promise<{ tenantId?: string }>;
}
