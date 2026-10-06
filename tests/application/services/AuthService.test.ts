import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { AuthService } from '../../../src/application/services/AuthService';

describe('AuthService Unit Tests', () => {
  const dummyPrisma: any = {
    apiTokens: {
      update: jest.fn().mockResolvedValue({ updated: true }),
    },
    apiToken: {
      update: jest.fn().mockResolvedValue({ updated: true }),
    },
  };

  const JWT_SECRET = process.env.JWT_SECRET || 'test';

  describe('Symmetric (HS256) Token Verification', () => {
    it('should create and verify a symmetric token', async () => {
      const authService = new AuthService(dummyPrisma);
      const token = await authService.createToken({ tenantId: 'tenant-123' });

      expect(token).toBeDefined();

      const payload = await authService.verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.tenantId).toBe('tenant-123');
      expect(payload?.iat).toBeDefined();
      expect(payload?.exp).toBeDefined();
    });

    it('should throw TOKEN_INVALID error for malformed token', async () => {
      const authService = new AuthService(dummyPrisma);
      await expect(authService.verifyToken('invalid.jwt.token')).rejects.toThrow('TOKEN_INVALID');
    });

    it('should return null for expired token', async () => {
      const authService = new AuthService(dummyPrisma);
      const expiredToken = jwt.sign(
        { tenantId: 'tenant-123', exp: Math.floor(Date.now() / 1000) - 100 },
        JWT_SECRET,
        { issuer: 'https://inventory.example.com' }
      );

      const payload = await authService.verifyToken(expiredToken);
      expect(payload).toBeNull();
    });
  });

  describe('Asymmetric (RS256) JWKS Token Verification', () => {
    let keyPair: crypto.KeyPairSyncResult<string, string>;
    let jwk: any;

    beforeAll(() => {
      keyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const keyObject = crypto.createPublicKey(keyPair.publicKey);
      jwk = keyObject.export({ format: 'jwk' });
      jwk.kid = 'test-rsa-kid-1';
      jwk.use = 'sig';
      jwk.alg = 'RS256';
    });

    it('should verify an RS256 token using injected JWKS keys', async () => {
      const authService = new AuthService(dummyPrisma, {
        keys: [jwk],
      });

      const token = jwt.sign(
        { tenantId: 'tenant-jwks-456' },
        keyPair.privateKey,
        {
          algorithm: 'RS256',
          keyid: 'test-rsa-kid-1',
          issuer: 'https://inventory.example.com',
          expiresIn: '1h',
        }
      );

      const payload = await authService.verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.tenantId).toBe('tenant-jwks-456');
    });

    it('should throw TOKEN_INVALID if RS256 token is signed with a different key', async () => {
      const otherKeyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const authService = new AuthService(dummyPrisma, {
        keys: [jwk],
      });

      const tokenWithOtherKey = jwt.sign(
        { tenantId: 'tenant-jwks-456' },
        otherKeyPair.privateKey,
        {
          algorithm: 'RS256',
          keyid: 'test-rsa-kid-1',
          issuer: 'https://inventory.example.com',
          expiresIn: '1h',
        }
      );

      await expect(authService.verifyToken(tokenWithOtherKey)).rejects.toThrow('TOKEN_INVALID');
    });

    it('should throw TOKEN_INVALID if key ID (kid) is not found in JWKS', async () => {
      const authService = new AuthService(dummyPrisma, {
        keys: [jwk],
      });

      const tokenWithUnknownKid = jwt.sign(
        { tenantId: 'tenant-jwks-456' },
        keyPair.privateKey,
        {
          algorithm: 'RS256',
          keyid: 'unknown-kid-999',
          issuer: 'https://inventory.example.com',
          expiresIn: '1h',
        }
      );

      await expect(authService.verifyToken(tokenWithUnknownKid)).rejects.toThrow('TOKEN_INVALID');
    });
  });

  describe('Token Revocation', () => {
    it('should revoke active token', async () => {
      const authService = new AuthService(dummyPrisma);
      const token = await authService.createToken({ tenantId: 'tenant-789' });

      const result = await authService.revokeToken(token);
      expect(result).toBe(true);
    });

    it('should return false if verifyToken fails during revocation', async () => {
      const authService = new AuthService(dummyPrisma);
      const result = await authService.revokeToken('invalid-token');
      expect(result).toBe(false);
    });
  });
});
