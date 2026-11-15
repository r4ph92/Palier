import { randomBytes } from 'node:crypto';

// 32 random bytes, base64url: a device key is the 43 characters the device authentication accepts, and a QR secret the key length HMAC-SHA256 wants.
const SECRET_BYTES = 32;

export function newDeviceKey(): string {
  return randomBytes(SECRET_BYTES).toString('base64url');
}

export function newQrSecret(): string {
  return randomBytes(SECRET_BYTES).toString('base64url');
}
