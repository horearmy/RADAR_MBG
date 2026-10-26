import {
  assertMfaEncryptionKey,
  createTotpProvisioningUri,
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaRecoveryCodes,
  generateTotpSecret,
  hashMfaRecoveryCode,
  verifyDoubleSubmitCsrf,
  verifyTotp,
} from './auth.security.js';

describe('authentication security helpers', () => {
  it('validates MFA encryption keys before security-sensitive state changes', () => {
    expect(assertMfaEncryptionKey('a'.repeat(64))).toBeUndefined();
    expect(() => assertMfaEncryptionKey(undefined)).toThrow();
    expect(() => assertMfaEncryptionKey('ab'.repeat(31))).toThrow();
    expect(() => assertMfaEncryptionKey('z'.repeat(64))).toThrow();
  });

  it('validates double-submit CSRF tokens without accepting missing values', () => {
    expect(verifyDoubleSubmitCsrf('same-token', 'same-token')).toBe(true);
    expect(verifyDoubleSubmitCsrf('cookie-token', 'header-token')).toBe(false);
    expect(verifyDoubleSubmitCsrf(undefined, 'token')).toBe(false);
  });

  it('encrypts and decrypts MFA secrets with authenticated encryption', () => {
    const key = 'a'.repeat(64);
    const encrypted = encryptMfaSecret('JBSWY3DPEHPK3PXP', key);

    expect(decryptMfaSecret(encrypted, key)).toBe('JBSWY3DPEHPK3PXP');
    expect(() => decryptMfaSecret(encrypted, 'b'.repeat(64))).toThrow();
  });

  it('verifies RFC 6238 TOTP values within the allowed clock window', () => {
    expect(verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59_000)).toBe(true);
    expect(verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '000000', 59_000)).toBe(false);
  });

  it('creates a strong base32 enrollment secret and provisioning URI', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(createTotpProvisioningUri(secret, 'operator@example.test'))
      .toContain(encodeURIComponent(secret));
    expect(createTotpProvisioningUri(secret, 'operator@example.test'))
      .toContain('otpauth://totp/');
  });

  it('generates unique one-time recovery codes and stores only fixed-length hashes', () => {
    const { codes, hashes } = generateMfaRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes.every((code) => /^[A-Za-z0-9_-]{22}$/.test(code))).toBe(true);
    expect(hashes).toHaveLength(10);
    expect(hashes.every((hash) => /^[a-f0-9]{64}$/.test(hash))).toBe(true);
    expect(hashes).not.toContain(codes[0]);
    expect(hashMfaRecoveryCode(codes[0])).toBe(hashes[0]);
  });
});
