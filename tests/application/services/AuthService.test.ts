import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AuthService, JwksKey } from '../../../src/application/services/AuthService';

describe('AuthService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      apiToken: {
        update: jest.fn().mockResolvedValue({ updated: true }),
      },
    };
  });

  it('should verify token signed with symmetric secret', async () => {
    const authService = new AuthService(mockPrisma);
    const token = jwt.sign(
      { tenantId: 'tenant-123' },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { issuer: 'https://inventory.example.com' }
    );

    const payload = await authService.verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.tenantId).toBe('tenant-123');
  });

  it('should verify token signed with asymmetric private key matching JWKS kid', async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const jwk = publicKey.export({ format: 'jwk' }) as JwksKey;
    const kid = 'test-key-id-1';
    jwk.kid = kid;

    const authService = new AuthService(mockPrisma, {
      jwksKeys: [jwk],
    });

    const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' });
    const token = jwt.sign(
      { tenantId: 'tenant-jwks-456' },
      privateKeyPem,
      {
        algorithm: 'RS256',
        keyid: kid,
        issuer: 'https://inventory.example.com',
      }
    );

    const payload = await authService.verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.tenantId).toBe('tenant-jwks-456');
  });

  it('should fail token verification when JWKS key is missing or invalid', async () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' });
    const token = jwt.sign(
      { tenantId: 'tenant-jwks-789' },
      privateKeyPem,
      {
        algorithm: 'RS256',
        keyid: 'unknown-kid',
        issuer: 'https://inventory.example.com',
      }
    );

    const authService = new AuthService(mockPrisma, { jwksKeys: [] });
    await expect(authService.verifyToken(token)).rejects.toThrow('TOKEN_INVALID');
  });
});
