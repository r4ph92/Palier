import { fileOfflineWalkStore } from '../src/parkingSessions/FileOfflineWalkStore';
import type { QueuedWalk } from '../src/parkingSessions/OfflineWalkStore';

const mockFiles = new Map<string, string>();

jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///documents/' },
  File: class {
    readonly uri: string;
    constructor(...parts: string[]) {
      this.uri = parts.join('');
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    text() {
      return Promise.resolve(mockFiles.get(this.uri) ?? '');
    }
    write(content: string) {
      mockFiles.set(this.uri, content);
      return Promise.resolve();
    }
  },
}));

const FILE_URI = 'file:///documents/offline-walks.json';
const walk: QueuedWalk = { sessionId: 'session-1', detectedAt: new Date(2026, 10, 4, 18, 5).getTime(), aisleMinor: 1 };

beforeEach(() => mockFiles.clear());

describe('the offline walks in a file of the app sandbox', () => {
  it('loads nothing before anything was saved', async () => {
    await expect(fileOfflineWalkStore().load()).resolves.toEqual([]);
  });

  it('loads in a new store what an earlier one saved, as after a relaunch', async () => {
    await fileOfflineWalkStore().save([walk, { ...walk, sessionId: 'session-2', aisleMinor: null }]);

    const loaded = await fileOfflineWalkStore().load();

    expect(loaded).toEqual([walk, { ...walk, sessionId: 'session-2', aisleMinor: null }]);
  });

  it.each([
    ['a file cut short', '[{"sessionId":"session-1","detec'],
    ['something other than a list', '{"sessionId":"session-1"}'],
    ['an empty file', ''],
  ])('loads an empty queue from %s', async (_case, content) => {
    mockFiles.set(FILE_URI, content);

    await expect(fileOfflineWalkStore().load()).resolves.toEqual([]);
  });

  it('drops the walks with a wrong type and keeps the others', async () => {
    const badWalks = [
      { ...walk, sessionId: '' },
      { ...walk, sessionId: 42 },
      { ...walk, detectedAt: 'yesterday' },
      { ...walk, detectedAt: null },
      { ...walk, aisleMinor: 1.5 },
      { ...walk, aisleMinor: -1 },
      { ...walk, aisleMinor: 65536 },
      { ...walk, aisleMinor: '1' },
      null,
      'session-1',
    ];
    mockFiles.set(FILE_URI, JSON.stringify([...badWalks, walk, { ...walk, aisleMinor: 65535 }]));

    const loaded = await fileOfflineWalkStore().load();

    expect(loaded).toEqual([walk, { ...walk, aisleMinor: 65535 }]);
  });
});
