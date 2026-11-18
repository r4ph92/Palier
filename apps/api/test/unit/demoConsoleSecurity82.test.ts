import type { GateIdentity, GatePassageResponse } from '@palier/shared-types';
import type { FastifyInstance, HTTPMethods } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/http/buildServer.ts';
import { DEMO_ASSETS, demoAssetUrl } from '../../src/http/demo/demoAssets.ts';
import { DEMO_SECURITY_HEADERS } from '../../src/http/demo/demoConsoleRoutes.ts';
import { isSendableDeviceKey } from '../../src/http/demo/gateIdentity.js';
import { restoredLanguage } from '../../src/http/demo/languageStorage.js';
import type { PressOutcome } from '../../src/http/demo/loopPress.js';
import { applyPressOutcome, patchIfKeyUnchanged } from '../../src/http/demo/pressOutcome.js';
import { registeredRoutes } from './configureServer.ts';
import { serverDependencies } from './fakes/serverDependencies.ts';

// Adversarial regression guard for story #82, console side — the properties proven in a browser against the lane (see
// .claude/work/82-gate-console-polish/pentest.log): headers on every asset and method, a fixed list of files, a key check
// that lets nothing through a header cannot carry, a stored language that is never trusted, and stale answers that name no gate.
const CONSOLE_URLS = Object.keys(DEMO_ASSETS).map((fileName) => demoAssetUrl(fileName));
const ENTREE_KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
const entreeDemo: GateIdentity = { id: 'gate-701', name: 'Entrée Démo', kind: 'ENTRY', lotName: 'Parking Démo' };
const countedEntry: GatePassageResponse = { gateId: entreeDemo.id, lotId: 'lot-201', kind: 'ENTRY', closedAt: '2026-11-17T21:05:00.000Z', vehicleCount: 3, confirmedSessionId: null, exitedSessionId: null };

const FILES_THAT_MUST_NOT_BE_SERVED = [
  '/demo',
  '/demo/',
  '/demo/console/',
  '/demo/CONSOLE',
  '/demo/console.html',
  '/demo/demoAssets.ts',
  '/demo/demoConsoleRoutes.ts',
  '/demo/.env',
  '/demo/package.json',
  '/demo/%2e%2e/%2e%2e/package.json',
  '/demo/..%2f..%2f..%2f.env',
  '/demo/..%5c..%5c.env',
  '/demo/console.js%00.ttf',
  '/demo/console.js/..%2f..%2f..%2f..%2fpackage.json',
  '/demo/node_modules/@expo-google-fonts/archivo/package.json',
  '/demo/@expo-google-fonts/archivo/400Regular/Archivo_400Regular.ttf',
  '/demo//console',
];

describe('story #82 attack surface: console assets', () => {
  let server: FastifyInstance;

  beforeEach(() => {
    server = buildServer(serverDependencies({ settings: { demoMode: true } }));
  });

  afterEach(() => server.close());

  it.each(CONSOLE_URLS)('sends the console headers on a HEAD of %s too', async (url) => {
    const response = await server.inject({ method: 'HEAD', url });

    expect(response.statusCode).toBe(200);
    expect(response.headers).toMatchObject(DEMO_SECURITY_HEADERS);
  });

  it('serves nothing under /demo but the fixed list of console files, with no parameter in any path', async () => {
    const demoRoutes = (await registeredRoutes(server)).filter((route) => route.includes(' /demo'));

    expect([...demoRoutes].sort()).toEqual(CONSOLE_URLS.map((url) => `GET ${url}`).sort());
    expect(demoRoutes.join(' ')).not.toMatch(/[:*]/);
  });

  it.each(FILES_THAT_MUST_NOT_BE_SERVED)('answers 404 and no file for %s', async (url) => {
    const response = await server.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('has no %s on the console page', async (method: HTTPMethods) => {
    const response = await server.inject({ method, url: '/demo/console', payload: { deviceKey: ENTREE_KEY } });

    expect(response.statusCode).toBe(404);
  });
});

describe('story #82 attack surface: what the console accepts as a device key', () => {
  it('lets through exactly the characters from ! to ~, one by one', () => {
    const accepted: number[] = [];
    for (let codeUnit = 0; codeUnit <= 0xffff; codeUnit += 1) {
      if (isSendableDeviceKey(String.fromCharCode(codeUnit))) {
        accepted.push(codeUnit);
      }
    }

    expect(accepted).toEqual(Array.from({ length: 94 }, (_unused, index) => 0x21 + index));
  });

  it.each([
    ['a header smuggled after the key', `${ENTREE_KEY}\r\nX-Forwarded-For: 127.0.0.1`],
    ['a bare line feed', `${ENTREE_KEY}\nSet-Cookie: a=b`],
    ['a bare carriage return', `${ENTREE_KEY}\rHost: evil.example`],
    ['a NUL byte', `${ENTREE_KEY}${String.fromCharCode(0)}`],
    ['a tab', `${ENTREE_KEY.slice(0, 20)}\t${ENTREE_KEY.slice(20)}`],
    ['a second token after a space', `${ENTREE_KEY} ${ENTREE_KEY}`],
    ['a line separator', `${ENTREE_KEY}${String.fromCharCode(0x2028)}`],
    ['a byte-order mark in front', `${String.fromCharCode(0xfeff)}${ENTREE_KEY}`],
    ['a Latin-1 letter a header would carry as one byte', `${ENTREE_KEY}${String.fromCharCode(0xe9)}`],
    ['nothing at all', ''],
    ['513 characters', 'k'.repeat(513)],
  ])('never sends %s', (_case, deviceKey) => {
    expect(isSendableDeviceKey(deviceKey)).toBe(false);
  });
});

describe('story #82 attack surface: the stored language', () => {
  const storing = (stored: unknown) => ({ getItem: () => stored as string | null, setItem: () => undefined });

  it.each([
    'en"><script>alert(1)</script>',
    'en onload=alert(1)',
    'en ',
    ' en',
    `en${String.fromCharCode(0)}`,
    'EN',
    'fr-CA',
    '__proto__',
    'constructor',
    '["en"]',
    'x'.repeat(100_000),
  ])('starts in French for the stored value %j', (stored) => {
    expect(restoredLanguage(storing(stored))).toBe('fr');
  });

  it('does not take a stored value that only reads as "en" once converted', () => {
    expect(restoredLanguage(storing({ toString: () => 'en' }))).toBe('fr');
    expect(restoredLanguage(storing(['en']))).toBe('fr');
  });
});

describe('story #82 attack surface: an answer that arrives after the key changed', () => {
  const outcomes: readonly PressOutcome[] = [
    { kind: 'recorded', identity: entreeDemo, passage: countedEntry },
    { kind: 'wrongLoop', identity: entreeDemo },
    { kind: 'refused', identity: null, messageKey: 'keyRefused' },
  ];
  const keysNowInTheField = ['', 'Vlsp0SpmrjrASkf5BViukfAHhaqATVEuKnksWh1tcOw', ENTREE_KEY.toLowerCase(), `${ENTREE_KEY}A`, ENTREE_KEY.slice(0, -1)];

  it.each(keysNowInTheField)('names no gate and says nothing when the field now holds %j', (deviceKey) => {
    for (const outcome of outcomes) {
      const patch = applyPressOutcome({ deviceKey, passages: [] }, ENTREE_KEY, outcome);

      expect(Object.keys(patch)).toEqual(['passages']);
    }
    expect(patchIfKeyUnchanged({ deviceKey }, ENTREE_KEY, { identity: entreeDemo, message: { key: 'gateForbidden', isError: true } })).toEqual({});
  });
});
