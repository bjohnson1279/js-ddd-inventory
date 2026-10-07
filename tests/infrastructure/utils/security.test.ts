import { hashPassword, verifyPassword, encryptSymmetric, decryptSymmetric } from '../../../src/infrastructure/utils/security';

describe('Security Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('hashPassword', () => {
    it('should generate a hash in the format salt:hash', () => {
      const password = 'mySuperSecretPassword123!';
      const result = hashPassword(password);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      const parts = result.split(':');
      expect(parts.length).toBe(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it('should generate different hashes for the same password due to random salt', () => {
      const password = 'password123';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      expect(hash1).not.toBe(hash2);

      // Both should still be valid
      expect(verifyPassword(password, hash1)).toBe(true);
      expect(verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for the correct password', () => {
      const password = 'securePassword!';
      const hash = hashPassword(password);

      const isValid = verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should return false for an incorrect password', () => {
      const password = 'securePassword!';
      const hash = hashPassword(password);

      const isValid = verifyPassword('wrongPassword!', hash);
      expect(isValid).toBe(false);
    });

    it('should return false for an empty stored hash', () => {
      const password = 'password123';

      expect(verifyPassword(password, '')).toBe(false);
    });

    it('should return false for a malformed stored hash (no salt)', () => {
      const password = 'password123';
      const hash = hashPassword(password);
      const [_, hashPart] = hash.split(':');

      // Pass only the hash part
      expect(verifyPassword(password, hashPart)).toBe(false);
    });

    it('should return false for a malformed stored hash (no hash)', () => {
      const password = 'password123';
      const hash = hashPassword(password);
      const [salt, _] = hash.split(':');

      // Pass only the salt part
      expect(verifyPassword(password, `${salt}:`)).toBe(false);
    });

    it('should return false if the hash is completely invalid', () => {
      const password = 'password123';

      expect(verifyPassword(password, 'invalid:format:hash')).toBe(false);
    });

    it('should return false for empty password against a valid hash of non-empty password', () => {
      const password = 'password123';
      const hash = hashPassword(password);

      expect(verifyPassword('', hash)).toBe(false);
    });

    it('should handle hashing and verifying an empty password correctly', () => {
      const password = '';
      const hash = hashPassword(password);

      expect(verifyPassword(password, hash)).toBe(true);
      expect(verifyPassword('notempty', hash)).toBe(false);
    });
  });

  describe('encryptSymmetric and decryptSymmetric', () => {
    it('should encrypt and decrypt a string successfully', () => {
      const plaintext = 'sensitive_db_password_123';
      const encrypted = encryptSymmetric(plaintext);
      expect(encrypted).not.toBe(plaintext);

      const decrypted = decryptSymmetric(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should throw an error for malformed or invalid ciphertext instead of returning it', () => {
      expect(() => decryptSymmetric('invalid:ciphertext:format')).toThrow('Decryption failed');
    });

    it('should throw error when ENCRYPTION_KEY is unset in non-test environment', () => {
      delete process.env.ENCRYPTION_KEY;
      process.env.NODE_ENV = 'production';

      expect(() => encryptSymmetric('test')).toThrow('ENCRYPTION_KEY environment variable is required for security.');
    });

    it('should succeed when ENCRYPTION_KEY is provided in non-test environment', () => {
      process.env.ENCRYPTION_KEY = 'custom_production_key_12345';
      process.env.NODE_ENV = 'production';

      const encrypted = encryptSymmetric('test_data');
      const decrypted = decryptSymmetric(encrypted);
      expect(decrypted).toBe('test_data');
    });

    it('should use fallback secret key when NODE_ENV is test and ENCRYPTION_KEY is unset', () => {
      delete process.env.ENCRYPTION_KEY;
      process.env.NODE_ENV = 'test';

      const encrypted = encryptSymmetric('test_data');
      const decrypted = decryptSymmetric(encrypted);
      expect(decrypted).toBe('test_data');
    });
  });

  describe('parseAllowedOrigins', () => {
    it('should return default origin if process.env.FRONTEND_URL is undefined or empty', () => {
      const { parseAllowedOrigins } = require('../../../src/index');
      expect(parseAllowedOrigins(undefined)).toEqual(['http://localhost:3080']);
      expect(parseAllowedOrigins('')).toEqual(['http://localhost:3080']);
    });

    it('should parse valid origins and strip paths, trailing slashes, and query parameters', () => {
      const { parseAllowedOrigins } = require('../../../src/index');
      const input = 'https://example.com/path/to/page?query=1, http://app.domain.org:8080/dashboard/';
      expect(parseAllowedOrigins(input)).toEqual([
        'https://example.com',
        'http://app.domain.org:8080'
      ]);
    });

    it('should filter out invalid URLs and non-http/https protocols', () => {
      const { parseAllowedOrigins } = require('../../../src/index');
      const input = 'ftp://invalid.com, javascript:alert(1), not-a-url, https://valid.com';
      expect(parseAllowedOrigins(input)).toEqual(['https://valid.com']);
    });

    it('should fallback to default if all provided URLs are invalid', () => {
      const { parseAllowedOrigins } = require('../../../src/index');
      const input = 'invalid1, ftp://invalid2.com, file:///path';
      expect(parseAllowedOrigins(input)).toEqual(['http://localhost:3080']);
    });
  });
});
