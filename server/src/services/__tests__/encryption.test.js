import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config before importing encryption module
vi.mock('../../config/env.js', () => ({
  default: { budgetMasterKey: 'test-budget-master-key-32chars!!' },
}));

const { encrypt, decrypt, encryptBudget, decryptBudget } = await import('../encryption.js');

describe('encryption service', () => {
  const masterKey = 'my-secure-master-key-for-testing';

  describe('encrypt / decrypt round-trip', () => {
    it('round-trips a simple string', () => {
      const plaintext = 'hello world';
      const encrypted = encrypt(plaintext, masterKey);
      const decrypted = decrypt(encrypted, masterKey);
      expect(decrypted).toBe(plaintext);
    });

    it('round-trips an empty string', () => {
      const encrypted = encrypt('', masterKey);
      const decrypted = decrypt(encrypted, masterKey);
      expect(decrypted).toBe('');
    });

    it('round-trips unicode characters', () => {
      const plaintext = '日本語テスト 🎉 café résumé';
      const encrypted = encrypt(plaintext, masterKey);
      expect(decrypt(encrypted, masterKey)).toBe(plaintext);
    });

    it('round-trips a long string', () => {
      const plaintext = 'x'.repeat(10000);
      const encrypted = encrypt(plaintext, masterKey);
      expect(decrypt(encrypted, masterKey)).toBe(plaintext);
    });

    it('round-trips JSON content', () => {
      const plaintext = JSON.stringify({ budget: 1500, notes: 'Test "quotes"' });
      const encrypted = encrypt(plaintext, masterKey);
      expect(decrypt(encrypted, masterKey)).toBe(plaintext);
    });
  });

  describe('encryption output format', () => {
    it('produces valid JSON with expected fields', () => {
      const encrypted = encrypt('test', masterKey);
      const parsed = JSON.parse(encrypted);
      expect(parsed).toHaveProperty('c');  // ciphertext
      expect(parsed).toHaveProperty('iv'); // initialization vector
      expect(parsed).toHaveProperty('s');  // salt
      expect(parsed).toHaveProperty('t');  // auth tag
    });

    it('produces different ciphertext for the same plaintext (random salt/IV)', () => {
      const e1 = encrypt('same input', masterKey);
      const e2 = encrypt('same input', masterKey);
      expect(e1).not.toBe(e2);

      // But both decrypt to the same value
      expect(decrypt(e1, masterKey)).toBe('same input');
      expect(decrypt(e2, masterKey)).toBe('same input');
    });
  });

  describe('wrong key rejection', () => {
    it('throws when decrypting with wrong master key', () => {
      const encrypted = encrypt('secret data', masterKey);
      expect(() => decrypt(encrypted, 'wrong-key-entirely-different!!')).toThrow();
    });
  });

  describe('tamper detection', () => {
    it('throws when ciphertext is tampered', () => {
      const encrypted = encrypt('secret', masterKey);
      const parsed = JSON.parse(encrypted);
      // Flip a character in the ciphertext
      parsed.c = parsed.c.slice(0, -1) + (parsed.c.slice(-1) === 'A' ? 'B' : 'A');
      expect(() => decrypt(JSON.stringify(parsed), masterKey)).toThrow();
    });

    it('throws when auth tag is tampered', () => {
      const encrypted = encrypt('secret', masterKey);
      const parsed = JSON.parse(encrypted);
      // Replace auth tag with a completely different valid base64 string
      const tagBuf = Buffer.from(parsed.t, 'base64');
      tagBuf[0] ^= 0xff; // flip all bits of first byte
      parsed.t = tagBuf.toString('base64');
      expect(() => decrypt(JSON.stringify(parsed), masterKey)).toThrow();
    });

    it('throws when IV is tampered', () => {
      const encrypted = encrypt('secret', masterKey);
      const parsed = JSON.parse(encrypted);
      parsed.iv = parsed.iv.slice(0, -1) + (parsed.iv.slice(-1) === 'A' ? 'B' : 'A');
      expect(() => decrypt(JSON.stringify(parsed), masterKey)).toThrow();
    });
  });

  describe('budget wrappers', () => {
    it('encryptBudget / decryptBudget round-trip', () => {
      const plaintext = '2500.00';
      const encrypted = encryptBudget(plaintext);
      expect(decryptBudget(encrypted)).toBe(plaintext);
    });
  });

  describe('error handling', () => {
    it('throws on invalid JSON input to decrypt', () => {
      expect(() => decrypt('not-json', masterKey)).toThrow();
    });

    it('throws on malformed encrypted object', () => {
      expect(() => decrypt('{"c":"x"}', masterKey)).toThrow();
    });
  });
});
