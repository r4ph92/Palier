import { describe, expect, it } from 'vitest';
import { ONLINE, type Connection } from '../../src/http/demo/offlineControls.js';
import { restoredConnection, saveConnection } from '../../src/http/demo/queueStorage.js';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

const brokenStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

const item = { id: 'abcdef12-3456-4789-8abc-def123456789', kind: 'EXIT' as const, closedAt: '2026-11-01T14:00:00.000Z' };
const queue = { gateId: 'gate-702', kind: 'EXIT' as const, items: [item] };
const offline: Connection = { kind: 'offline', queue };

describe('queueStorage', () => {
  it('restarts offline with the saved queue after a reload', () => {
    const storage = memoryStorage();
    saveConnection(offline, storage);

    expect(restoredConnection(storage)).toEqual(offline);
  });

  it('restores a blocked queue as offline, so a retry decides again', () => {
    const storage = memoryStorage();
    saveConnection({ kind: 'blocked', queue }, storage);

    expect(restoredConnection(storage)).toEqual(offline);
  });

  it('stores no device key', () => {
    const storage = memoryStorage();
    saveConnection(offline, storage);

    expect([...storage.values.values()].join('')).not.toMatch(/deviceKey|authorization/i);
  });

  it('forgets the queue once the console is online', () => {
    const storage = memoryStorage();
    saveConnection(offline, storage);
    saveConnection(ONLINE, storage);

    expect(restoredConnection(storage)).toEqual(ONLINE);
  });

  it.each(['not json', '{"gateId":1}', '{"gateId":"g","kind":"EXIT","items":[{"id":1}]}', 'null'])('ignores the unusable value %s', (stored) => {
    expect(restoredConnection(memoryStorage({ 'palier.demoConsole.offlineQueue': stored }))).toEqual(ONLINE);
  });

  it('works without storage: nothing is kept and nothing throws', () => {
    expect(() => saveConnection(offline, brokenStorage)).not.toThrow();
    expect(restoredConnection(brokenStorage)).toEqual(ONLINE);
  });
});
