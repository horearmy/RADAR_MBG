import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function assertMfaEncryptionKey(keyHex: string | undefined): asserts keyHex is string {
  if (!keyHex || !/^[a-f\d]{64}$/i.test(keyHex)) {
    throw new Error('MFA_ENCRYPTION_KEY must be a 32-byte hexadecimal key');
  }
}

export function generateTotpSecret() {
  const bytes = randomBytes(20);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let secret = '';
  for (let offset = 0; offset < bits.length; offset += 5) {
    secret += BASE32_ALPHABET[Number.parseInt(bits.slice(offset, offset + 5).padEnd(5, '0'), 2)];
  }
  return secret;
}

export function createTotpProvisioningUri(secret: string, account: string) {
  const label = encodeURIComponent(`RADAR MBG:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer: 'RADAR MBG',
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function verifyDoubleSubmitCsrf(
  cookieToken?: string,
  headerToken?: string,
): boolean {
  if (!cookieToken || !headerToken) return false;

  const cookie = Buffer.from(cookieToken);
  const header = Buffer.from(headerToken);
  return cookie.length === header.length && timingSafeEqual(cookie, header);
}

export function decryptMfaSecret(encrypted: string, keyHex: string): string {
  assertMfaEncryptionKey(keyHex);

  const [version, ivHex, tagHex, cipherHex] = encrypted.split(':');
  if (version !== 'v1' || !ivHex || !tagHex || !cipherHex) {
    throw new Error('Invalid encrypted MFA secret');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(keyHex, 'hex'),
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

export function encryptMfaSecret(secret: string, keyHex: string): string {
  assertMfaEncryptionKey(keyHex);

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);

  return `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}

export function hashMfaRecoveryCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

export function generateMfaRecoveryCodes() {
  const codes = Array.from({ length: 10 }, () => randomBytes(16).toString('base64url'));
  return { codes, hashes: codes.map(hashMfaRecoveryCode) };
}

function decodeBase32(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = '';

  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid TOTP secret');
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpAt(secret: Buffer, timeStep: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(timeStep));
  const digest = createHmac('sha1', secret).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotp(
  secretBase32: string,
  code: string,
  now = Date.now(),
): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const secret = decodeBase32(secretBase32);
  const currentStep = Math.floor(now / 30_000);

  return [-1, 0, 1].some((step) => {
    const expected = Buffer.from(totpAt(secret, currentStep + step));
    const supplied = Buffer.from(code);
    return timingSafeEqual(expected, supplied);
  });
}
