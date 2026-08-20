import { hashPassword, verifyPassword } from '../../../src/infrastructure/utils/security';

describe('Security Utilities', () => {
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

  describe('decryptSymmetric', () => {
    const { decryptSymmetric } = require('../../../src/infrastructure/utils/security');

    it('should throw an error on decryption failure instead of returning ciphertext', () => {
      // Mock ENCRYPTION_KEY by ensuring the fallback format is matched (24 hex : 32 hex : even hex)
      const invalidCiphertext = '000000000000000000000000:00000000000000000000000000000000:0000';
      expect(() => decryptSymmetric(invalidCiphertext)).toThrow('Decryption failed');
    });

    it('should throw error if format does not match hex requirements', () => {
      const plaintext = 'not:hex:format';
      expect(() => decryptSymmetric(plaintext)).toThrow('Decryption failed');
    });

    it('should throw error if format length does not match requirements', () => {
      const plaintext = '1234:5678:9abc';
      expect(() => decryptSymmetric(plaintext)).toThrow('Decryption failed');
    });
  });
});
