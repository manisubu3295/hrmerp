import crypto from 'crypto';

// AES-256-GCM field-level encryption for genuinely sensitive columns
// (identity numbers, bank account numbers, SSO client secrets). Applied
// explicitly at each call site (not via a transparent Prisma extension) so
// what's encrypted stays auditable in the route code, not hidden magic.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const hex = process.env['ENCRYPTION_KEY'];
  if (!hex) throw new Error('ENCRYPTION_KEY environment variable is not set');
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be a 32-byte (64 hex character) key');
  return key;
}

// Output format: iv:authTag:ciphertext, all hex-encoded, so it's a single
// opaque string safe to store in an existing String column.
export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptField(encoded: string): string {
  const parts = encoded.split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted field value');
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex!, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex!, 'hex'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex!, 'hex')), decipher.final()]);
  return plaintext.toString('utf8');
}

// True if the value looks like our iv:authTag:ciphertext encoding — lets
// callers distinguish already-encrypted values from legacy plaintext during
// a rollout without a separate migration flag.
export function isEncryptedField(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i.test(value);
}
