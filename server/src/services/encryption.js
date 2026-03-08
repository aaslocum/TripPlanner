import crypto from 'node:crypto';
import config from '../config/env.js';

const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 32;
const ALGORITHM = 'aes-256-gcm';

function deriveKey(salt) {
  return crypto.pbkdf2Sync(
    config.budgetMasterKey, salt, ITERATIONS, KEY_LENGTH, 'sha512'
  );
}

export function encryptBudget(plaintext) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    c: ciphertext,
    iv: iv.toString('base64'),
    s: salt.toString('base64'),
    t: authTag.toString('base64'),
  });
}

export function decryptBudget(encryptedJson) {
  const { c, iv, s, t } = JSON.parse(encryptedJson);

  const salt = Buffer.from(s, 'base64');
  const key = deriveKey(salt);
  const ivBuf = Buffer.from(iv, 'base64');
  const authTag = Buffer.from(t, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(c, 'base64', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}
