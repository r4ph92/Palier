import { describe, expect, it } from 'vitest';
import { gateQrLink, isSignedWith, readGateToken, signGateToken } from '../../src/domain/entries/gateToken.ts';
import { ENTREE_DEMO_SECRET, SORTIE_DEMO_SECRET } from './fakes/entryFakes.ts';
import { entreeDemo } from './fakes/gateFixtures.ts';

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const token = signGateToken(entreeDemo.id, ENTREE_DEMO_SECRET);

function verifies(qrContent: string, secret: string | null = ENTREE_DEMO_SECRET): boolean {
  const read = readGateToken(qrContent);
  return read !== null && read.gateId === entreeDemo.id && isSignedWith(read, secret);
}

function alteredAt(position: number): string {
  const original = token[position] ?? '';
  const replacement = [...BASE64URL_ALPHABET].find((character) => character !== original) ?? '';
  return `${token.slice(0, position)}${replacement}${token.slice(position + 1)}`;
}

describe('gate QR token', () => {
  it('is the version, the gate id and a 43-character signature', () => {
    expect(token).toMatch(new RegExp(`^palier1\\.${entreeDemo.id}\\.[A-Za-z0-9_-]{43}$`));
  });

  it('verifies the bare token and the printed link alike', () => {
    expect(verifies(token)).toBe(true);
    expect(verifies(gateQrLink(entreeDemo.id, ENTREE_DEMO_SECRET))).toBe(true);
    expect(gateQrLink(entreeDemo.id, ENTREE_DEMO_SECRET)).toBe(`https://palier.app/q/${token}`);
  });

  it('ignores spaces pasted around the content', () => {
    expect(verifies(`  ${token}\n`)).toBe(true);
  });

  it.each([...token].map((_character, position) => position))('refuses the token altered at character %i', (position) => {
    expect(verifies(alteredAt(position))).toBe(false);
  });

  it('refuses a token signed with another gate secret', () => {
    expect(verifies(signGateToken(entreeDemo.id, SORTIE_DEMO_SECRET))).toBe(false);
  });

  it('refuses every token for a gate without a QR secret', () => {
    expect(verifies(token, null)).toBe(false);
  });

  it.each([
    ['an empty content', ''],
    ['a link to another site', `https://example.com/q/${token}`],
    ['an upper-case gate id', signGateToken('ABCDEF00-0000-4000-8000-000000000701', ENTREE_DEMO_SECRET)],
    ['another version', token.replace('palier1', 'palier2')],
    ['a token with something after it', `${token}.extra`],
    ['a shortened signature', token.slice(0, -1)],
  ])('does not read %s', (_case, qrContent) => {
    expect(readGateToken(qrContent)).toBeNull();
  });
});
