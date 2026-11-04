import { describe, expect, it, vi } from 'vitest';
import { createGateApi } from '../../src/http/demo/gateApi.js';
import { pressLoop } from '../../src/http/demo/loopPress.js';

const UNAUTHORIZED = 401;

function fetchThatValidatesHeadersLikeABrowser(): typeof fetch {
  return (input, init) => {
    new Request(new URL(String(input), 'http://localhost:3000'), init);
    return Promise.resolve(new Response(null, { status: UNAUTHORIZED }));
  };
}

describe('demo console with a wrong key the browser cannot put in a header', () => {
  it.each(['clé-🚗', 'clé—tiret', '’quote’'])('shows "Clé d’appareil refusée" for %s, not "Impossible de joindre Palier"', async (deviceKey) => {
    const api = createGateApi(fetchThatValidatesHeadersLikeABrowser());

    const outcome = await pressLoop({ loop: 'ENTRY', deviceKey, identity: null, pressedAt: new Date() }, api);

    expect(outcome).toMatchObject({ kind: 'refused', messageKey: 'keyRefused' });
  });

  it.each(['clé-🚗', `${'a'.repeat(42)}é`, `${'a'.repeat(42)}—`])(
    'sends no network request at all for the unsendable key %s',
    async (deviceKey) => {
      const fetchFunction = vi.fn(fetchThatValidatesHeadersLikeABrowser());

      await pressLoop({ loop: 'EXIT', deviceKey, identity: null, pressedAt: new Date() }, createGateApi(fetchFunction));

      expect(fetchFunction).not.toHaveBeenCalled();
    },
  );

  it('still reaches the API for a wrong key made of plain characters', async () => {
    const api = createGateApi(fetchThatValidatesHeadersLikeABrowser());

    const outcome = await pressLoop({ loop: 'ENTRY', deviceKey: 'wrong-key', identity: null, pressedAt: new Date() }, api);

    expect(outcome).toMatchObject({ kind: 'refused', messageKey: 'keyRefused' });
  });
});
