import crypto from 'crypto';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required for security.");
  }
  return crypto.createHash('sha256').update(key).digest();
}

export function encryptSymmetric(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSymmetric(ciphertext: string): string {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
  // Fallback for legacy plaintext passwords
  if (!ivHex || !authTagHex || !encryptedHex) {
    return ciphertext;
  }

  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    // If decryption fails (e.g. invalid key or corrupted data), fallback to returning it as plaintext
    // This provides robustness during secret rotation or if a plaintext string happens to contain two colons
    return ciphertext;
  }
}
