import { describe, expect, it, vi } from 'vitest';
import { pollCommands } from '../../src/http/demo/commandFeed.js';
import type { GateApi } from '../../src/http/demo/gateApi.js';
import { sendHeartbeat } from '../../src/http/demo/gateHeartbeat.js';
import { isSendableDeviceKey } from '../../src/http/demo/gateIdentity.js';
import { toggleOffline } from '../../src/http/demo/offlineControls.js';
import { sendReading } from '../../src/http/demo/readerRead.js';

const ENTREE_KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
const UNSAFE_KEYS = [
  ['a space inside', 'gkXGrHor9PJG FGYu4xrNZ5nMkid18rTHXBmuCuI63as'],
  ['an accent', 'clé-démo'],
  ['an emoji', 'key🔑'],
  ['a zero-width space after a real key', `${ENTREE_KEY}\u200B`],
  ['a no-break space inside', `gkXGr\u00A0Hor9`],
  ['a newline inside', 'gkXGr\nHor9'],
  ['a DEL character', 'gkXGr\u007FHor9'],
  ['600 characters', 'a'.repeat(600)],
] as const;

function spyApi() {
  const answer = vi.fn().mockResolvedValue({ status: 401, body: null });
  return {
    fetchIdentity: answer as unknown as GateApi['fetchIdentity'],
    postHeartbeat: answer as unknown as GateApi['postHeartbeat'],
    fetchCommands: answer as unknown as GateApi['fetchCommands'],
    replayPassages: answer as unknown as GateApi['replayPassages'],
    postIdentify: answer as unknown as GateApi['postIdentify'],
    answer,
  };
}

describe('a key a header cannot carry', () => {
  it.each(UNSAFE_KEYS)('is not sendable with %s', (_case, deviceKey) => {
    expect(isSendableDeviceKey(deviceKey)).toBe(false);
  });

  it.each(UNSAFE_KEYS)('never leaves the console by heartbeat, command poll, reader or replay with %s', async (_case, deviceKey) => {
    const api = spyApi();
    const queue = { gateId: 'gate-701', gateName: 'Entrée Démo', kind: 'ENTRY', items: [{ id: 'p-1', kind: 'ENTRY', closedAt: '2026-11-17T21:00:00.000Z' }] } as const;

    await sendHeartbeat({ deviceKey, identity: null }, api);
    await pollCommands(api, deviceKey, []);
    await sendReading({ deviceKey, identity: null, identifier: 'ABC123' }, api);
    const replay = await toggleOffline({ connection: { kind: 'offline', queue }, deviceKey, identity: null }, api);

    expect(api.answer).not.toHaveBeenCalled();
    expect(replay.message).toMatchObject({ key: 'replayKeyHint' });
  });

  it('sends a 512-character key, the longest Palier is asked about', () => {
    expect(isSendableDeviceKey('a'.repeat(512))).toBe(true);
    expect(isSendableDeviceKey('a'.repeat(513))).toBe(false);
  });
});
