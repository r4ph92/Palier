import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';

interface DemoAsset {
  readonly url: string;
  readonly fileName: string;
  readonly contentType: string;
}

const DEMO_ASSETS: readonly DemoAsset[] = [
  { url: '/demo/console', fileName: 'console.html', contentType: 'text/html; charset=utf-8' },
  { url: '/demo/console.css', fileName: 'console.css', contentType: 'text/css; charset=utf-8' },
  { url: '/demo/console.js', fileName: 'console.js', contentType: 'text/javascript; charset=utf-8' },
  { url: '/demo/consoleLogic.js', fileName: 'consoleLogic.js', contentType: 'text/javascript; charset=utf-8' },
  { url: '/demo/consoleTranslations.js', fileName: 'consoleTranslations.js', contentType: 'text/javascript; charset=utf-8' },
];

const SECURITY_HEADERS = {
  'content-security-policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
} as const;

export function registerDemoConsoleRoutes(server: FastifyInstance): void {
  for (const asset of DEMO_ASSETS) {
    const content = readFileSync(new URL(asset.fileName, import.meta.url), 'utf8');
    server.get(asset.url, async (_request, reply) => reply.headers(SECURITY_HEADERS).type(asset.contentType).send(content));
  }
}
