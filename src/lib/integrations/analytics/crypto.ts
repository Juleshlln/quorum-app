import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const CREDENTIALS_ENCRYPTION_VERSION = 'v1';

let _cachedKey: Buffer | null = null;

function getSecretKey() {
  if (_cachedKey) return _cachedKey;

  const secret = process.env.INTEGRATIONS_SECRET_KEY;
  if (!secret) {
    throw new Error(
      'Missing INTEGRATIONS_SECRET_KEY environment variable. ' +
      'This dedicated key is required to encrypt/decrypt analytics credentials. ' +
      'Generate one with: openssl rand -base64 32',
    );
  }
  _cachedKey = createHash('sha256').update(secret).digest();
  return _cachedKey;
}

export function encryptCredentials(raw: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    CREDENTIALS_ENCRYPTION_VERSION,
    iv.toString('base64'),
    encrypted.toString('base64'),
    tag.toString('base64'),
  ].join(':');
}

export function decryptCredentials(payload: string) {
  const [version, ivBase64, encryptedBase64, tagBase64] = payload.split(':');
  if (version !== CREDENTIALS_ENCRYPTION_VERSION || !ivBase64 || !encryptedBase64 || !tagBase64) {
    throw new Error('Unsupported credentials payload format');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getSecretKey(),
    Buffer.from(ivBase64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
