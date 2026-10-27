import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { serverDependencies } from './fakes/serverDependencies.ts';

const CONSOLE_ASSETS = [
  ['/demo/console', 'text/html'],
  ['/demo/console.css', 'text/css'],
  ['/demo/console.js', 'text/javascript'],
  ['/demo/consoleLogic.js', 'text/javascript'],
  ['/demo/consoleTranslations.js', 'text/javascript'],
] as const;

const CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

describe('demo console', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  it.each(CONSOLE_ASSETS)('serves %s in demo mode with the console headers', async (url, contentType) => {
    server = buildServer(serverDependencies({ demoMode: true }));

    const response = await server.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain(contentType);
    expect(response.headers).toMatchObject({
      'content-security-policy': CONTENT_SECURITY_POLICY,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'cache-control': 'no-store',
    });
  });

  it.each(CONSOLE_ASSETS)('does not exist outside demo mode: %s', async (url) => {
    server = buildServer(serverDependencies());

    const response = await server.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(404);
  });

  it('has no inline script or style that the policy would block', async () => {
    server = buildServer(serverDependencies({ demoMode: true }));

    const page = (await server.inject({ method: 'GET', url: '/demo/console' })).body;

    expect(page).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/);
    expect(page).not.toMatch(/<style|\sstyle=|\son[a-z]+=/);
  });

  it('asks for the device key in a password field that browsers do not fill or remember', async () => {
    server = buildServer(serverDependencies({ demoMode: true }));

    const page = (await server.inject({ method: 'GET', url: '/demo/console' })).body;

    expect(page).toMatch(/<input id="device-key"[^>]*type="password"[^>]*autocomplete="off"/);
    expect(page).not.toContain('<form');
  });
});
