import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { DEMO_ASSETS, demoAssetUrl } from './demoAssets.ts';

export const DEMO_SECURITY_HEADERS = {
  'content-security-policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
} as const;

export function registerDemoConsoleRoutes(server: FastifyInstance): void {
  for (const [fileName, asset] of Object.entries(DEMO_ASSETS)) {
    const content = readFileSync(asset.location);
    server.get(demoAssetUrl(fileName), async (_request, reply) =>
      reply.headers(DEMO_SECURITY_HEADERS).type(asset.contentType).send(content),
    );
  }
}
