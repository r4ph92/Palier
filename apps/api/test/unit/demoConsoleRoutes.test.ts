import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { DEMO_ASSETS, demoAssetUrl } from '../../src/http/demo/demoAssets.ts';
import { DEMO_SECURITY_HEADERS } from '../../src/http/demo/demoConsoleRoutes.ts';
import { serverDependencies } from './fakes/serverDependencies.ts';

const CONSOLE_ASSETS = Object.entries(DEMO_ASSETS).map(([fileName, asset]) => [demoAssetUrl(fileName), asset.contentType] as const);

describe('demo console', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  it.each(CONSOLE_ASSETS)('serves %s in demo mode with the console headers', async (url, contentType) => {
    server = buildServer(serverDependencies({ demoMode: true }));

    const response = await server.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain(contentType);
    expect(response.headers).toMatchObject(DEMO_SECURITY_HEADERS);
  });

  it.each(CONSOLE_ASSETS)('does not exist outside demo mode: %s', async (url) => {
    server = buildServer(serverDependencies());

    const response = await server.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(404);
  });

  it('lets the page load scripts, styles and data only from itself', () => {
    expect(DEMO_SECURITY_HEADERS['content-security-policy']).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
  });

  it('serves the page and its scripts', () => {
    expect(CONSOLE_ASSETS.map(([url]) => url)).toEqual(expect.arrayContaining(['/demo/console', '/demo/console.js']));
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
