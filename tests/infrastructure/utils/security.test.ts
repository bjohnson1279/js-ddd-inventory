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

    it('should enforce strict output format lengths (32-char salt, 128-char hash)', () => {
      const password = 'strictFormatTest123!';
      const result = hashPassword(password);
      const [salt, hash] = result.split(':');

      // 16 bytes random salt = 32 hex chars
      expect(salt).toHaveLength(32);
      expect(/^[0-9a-f]{32}$/i.test(salt)).toBe(true);

      // 64 bytes pbkdf2 hash = 128 hex chars
      expect(hash).toHaveLength(128);
      expect(/^[0-9a-f]{128}$/i.test(hash)).toBe(true);
    });

    it('should throw an error for null or undefined input', () => {
      expect(() => hashPassword(null as any)).toThrow();
      expect(() => hashPassword(undefined as any)).toThrow();
    });

    it('should hash extremely long passwords', () => {
      const longPassword = 'a'.repeat(10000);
      const hash = hashPassword(longPassword);
      expect(hash).toBeDefined();
      const parts = hash.split(':');
      expect(parts.length).toBe(2);
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

    it('should throw an error or handle null/undefined password input safely', () => {
      const validHash = hashPassword('validPassword');
      // Depending on implementation it might throw or return false.
      // The current implementation calls crypto.pbkdf2Sync which will throw on null password.
      expect(() => verifyPassword(null as any, validHash)).toThrow();
      expect(() => verifyPassword(undefined as any, validHash)).toThrow();
    });

    it('should handle null/undefined storedHash gracefully', () => {
      const password = 'password123';
      expect(() => verifyPassword(password, null as any)).toThrow();
      expect(() => verifyPassword(password, undefined as any)).toThrow();
    });

    it('should successfully verify extremely long passwords', () => {
      const longPassword = 'b'.repeat(10000);
      const hash = hashPassword(longPassword);
      expect(verifyPassword(longPassword, hash)).toBe(true);
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
});
