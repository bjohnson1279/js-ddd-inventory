import { AuthService } from '../../../src/application/services/AuthService';
import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

describe('AuthService Unit Tests', () => {
  let authService: AuthService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      apiToken: {
        update: jest.fn(),
      },
    };
    authService = new AuthService(mockPrisma as any);
  });

  describe('createToken & verifyToken', () => {
    it('should create and verify a valid token', async () => {
      const claims = { tenantId: 'tenant-123', scopes: ['read:inventory'] };
      const token = await authService.createToken(claims);

      expect(typeof token).toBe('string');

      const verified = await authService.verifyToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.tenantId).toBe('tenant-123');
    });

    it('should throw TOKEN_INVALID when token verification fails with JsonWebTokenError', async () => {
      const invalidToken = 'invalid.jwt.token';

      await expect(authService.verifyToken(invalidToken)).rejects.toThrow('TOKEN_INVALID');
    });

    it('should verify token using JWKS key when JWKS is configured', async () => {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });

      const jwk = publicKey.export({ format: 'jwk' }) as any;
      jwk.kid = 'key-test-1';
      jwk.alg = 'RS256';

      authService.setJWKS({
        keys: [jwk],
      });

      const rsaToken = jwt.sign(
        { tenantId: 'tenant-rsa' },
        privateKey,
        {
          algorithm: 'RS256',
          issuer: 'https://inventory.example.com',
          keyid: 'key-test-1',
        }
      );

      const verified = await authService.verifyToken(rsaToken);
      expect(verified).not.toBeNull();
      expect(verified?.tenantId).toBe('tenant-rsa');
    });
  });

  describe('revokeToken', () => {
    it('should return false if token verification returns null or throws', async () => {
      const result = await authService.revokeToken('invalid.token');
      expect(result).toBe(false);
    });

    it('should update database and return true on successful revocation', async () => {
      const validToken = jwt.sign(
        { tenantId: 'tenant-123' },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { issuer: 'https://inventory.example.com' }
      );

      mockPrisma.apiToken.update.mockResolvedValue({ id: 'token-123', isActive: false });

      const result = await authService.revokeToken(validToken);
      expect(result).toBe(true);
      expect(mockPrisma.apiToken.update).toHaveBeenCalledWith({
        where: { id: validToken },
        data: { isActive: false },
      });
    });
  });

  describe('validateRequest', () => {
    it('should throw TOKEN_NOT_FOUND when authorization header is missing', async () => {
      await expect(authService.validateRequest({})).rejects.toThrow('TOKEN_NOT_FOUND');
    });

    it('should validate request and return tenantId when valid bearer token provided', async () => {
      const validToken = jwt.sign(
        { tenantId: 'tenant-123' },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { issuer: 'https://inventory.example.com' }
      );

      const result = await authService.validateRequest({
        authorization: `Bearer ${validToken}`,
      });

      expect(result).toEqual({ tenantId: 'tenant-123' });
    });
  });
});
