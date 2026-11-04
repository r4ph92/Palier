import { createHmac, timingSafeEqual } from 'node:crypto';
import { QR_LINK_PREFIX } from '@palier/shared-types/entryLink';

const TOKEN_VERSION = 'palier1';
// Version, gate id (a lower-case UUID) and a base64url HMAC-SHA256; anything else is refused before any lookup.
const TOKEN_PATTERN = /^(palier1\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))\.([A-Za-z0-9_-]{43})$/;

// HMAC-SHA256 wants a key as long as its output; a shorter or empty secret would make the gate's tokens guessable.
const MINIMUM_SECRET_BYTES = 32;

export interface GateToken {
  readonly gateId: string;
  readonly signedPart: string;
  readonly signature: string;
}

export function signGateToken(gateId: string, qrSecret: string): string {
  const key = secretKeyOf(qrSecret);
  if (key === null) {
    throw new Error(`The QR secret must decode to at least ${MINIMUM_SECRET_BYTES} bytes.`);
  }
  const signedPart = `${TOKEN_VERSION}.${gateId}`;
  return `${signedPart}.${signatureOf(signedPart, key)}`;
}

export function gateQrLink(gateId: string, qrSecret: string): string {
  return `${QR_LINK_PREFIX}${signGateToken(gateId, qrSecret)}`;
}

// The QR holds the link; the bare token after it is accepted too, so a tester can paste either.
export function readGateToken(qrContent: string): GateToken | null {
  const trimmed = qrContent.trim();
  const token = trimmed.startsWith(QR_LINK_PREFIX) ? trimmed.slice(QR_LINK_PREFIX.length) : trimmed;
  const match = TOKEN_PATTERN.exec(token);
  if (match === null) {
    return null;
  }
  const [, signedPart = '', gateId = '', signature = ''] = match;
  return { gateId, signedPart, signature };
}

export function isSignedWith(token: GateToken, qrSecret: string | null): boolean {
  const key = qrSecret === null ? null : secretKeyOf(qrSecret);
  if (key === null) {
    return false;
  }
  const received = Buffer.from(token.signature, 'utf8');
  const expected = Buffer.from(signatureOf(token.signedPart, key), 'utf8');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function secretKeyOf(qrSecret: string): Buffer | null {
  const key = Buffer.from(qrSecret, 'base64url');
  return key.length >= MINIMUM_SECRET_BYTES ? key : null;
}

function signatureOf(signedPart: string, key: Buffer): string {
  return createHmac('sha256', key).update(signedPart, 'utf8').digest('base64url');
}
