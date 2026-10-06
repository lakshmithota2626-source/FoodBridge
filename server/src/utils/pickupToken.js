const crypto = require('crypto');
const env = require('../config/env');

const key = () => crypto.createHash('sha256').update(env.jwtSecret).digest();
const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

function createPickupToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { token, tokenHash: hash(token), ciphertext: [iv, tag, ciphertext].map((x) => x.toString('base64url')).join('.') };
}

function decryptPickupToken(ciphertext) {
  const [ivText, tagText, payloadText] = ciphertext.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(payloadText, 'base64url')), decipher.final()]).toString('utf8');
}

function matches(token, tokenHash) {
  if (typeof token !== 'string' || !token) return false;
  const actual = Buffer.from(hash(token), 'hex');
  const expected = Buffer.from(tokenHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = { createPickupToken, decryptPickupToken, matches };
