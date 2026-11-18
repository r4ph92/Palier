import { describe, expect, it, vi } from 'vitest';

vi.mock('node:module', () => ({
  createRequire: () => ({
    resolve: () => {
      throw new Error('a font package was resolved');
    },
  }),
}));

describe('demo assets without demo mode', () => {
  it('does not resolve a font package when the module is imported', async () => {
    const { DEMO_ASSETS } = await import('../../src/http/demo/demoAssets.ts');

    expect(Object.keys(DEMO_ASSETS).some((fileName) => fileName.endsWith('.ttf'))).toBe(true);
  });

  it('builds a server without demo mode while the font packages cannot be resolved', async () => {
    const { buildServer } = await import('../../src/http/buildServer.ts');
    const { serverDependencies } = await import('./fakes/serverDependencies.ts');

    expect(() => buildServer(serverDependencies())).not.toThrow();
  }, 30_000);

  it('resolves the fonts only when the demo routes are registered', async () => {
    const { DEMO_ASSETS } = await import('../../src/http/demo/demoAssets.ts');

    expect(() => DEMO_ASSETS['Archivo_400Regular.ttf']?.location()).toThrow('a font package was resolved');
  });
});
