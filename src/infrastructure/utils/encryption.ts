import crypto from "crypto";

const algorithm = 'aes-256-gcm';

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required for security.');
  }
  cachedKey = crypto.scryptSync(envKey, 'salt', 32);
  return cachedKey;
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    return encryptedText;
  }
  const [ivHex, authTagHex, cipherHex] = parts;

  const isHex = (str: string) => /^[0-9a-fA-F]*$/.test(str);

  if (
    ivHex.length !== 24 || !isHex(ivHex) ||
    authTagHex.length !== 32 || !isHex(authTagHex) ||
    cipherHex.length % 2 !== 0 || !isHex(cipherHex)
  ) {
    return encryptedText;
  }

  try {
    const decipher = crypto.createDecipheriv(algorithm, getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    throw new Error('Failed to decrypt secret');
  }
}
