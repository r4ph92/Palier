import appConfig from '../app.config';
import { fileLocationExplanationStore, rememberingAnswer } from '../src/deviceLocation/LocationExplanationStore';
import { MemoryLocationExplanationStore } from './fakeLocationExplanationStore';

const mockFiles = new Set<string>();
const mockCreate = jest.fn();
let mockCreateFails = false;

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
    create(options: unknown) {
      mockCreate(options);
      if (mockCreateFails) {
        throw new Error('fake disk full');
      }
      mockFiles.add(this.uri);
    }
  },
}));

beforeEach(() => {
  mockFiles.clear();
  mockCreate.mockClear();
  mockCreateFails = false;
});

describe('the device flag in a file of the app sandbox', () => {
  it('starts unanswered, then stays answered once the file exists', async () => {
    const store = fileLocationExplanationStore();

    await expect(store.wasAnswered()).resolves.toBe(false);
    await store.markAnswered();

    await expect(store.wasAnswered()).resolves.toBe(true);
    await expect(fileLocationExplanationStore().wasAnswered()).resolves.toBe(true);
  });

  it('marks the answer twice without failing', async () => {
    const store = fileLocationExplanationStore();

    await store.markAnswered();
    await store.markAnswered();

    expect(mockCreate).toHaveBeenCalledWith({ overwrite: true });
  });

  it('rejects instead of throwing when the file cannot be written, and still counts as answered in memory', async () => {
    mockCreateFails = true;
    const store = rememberingAnswer(fileLocationExplanationStore());

    await expect(store.markAnswered()).rejects.toThrow('fake disk full');

    await expect(store.wasAnswered()).resolves.toBe(true);
    await expect(fileLocationExplanationStore().wasAnswered()).resolves.toBe(false);
  });
});

describe('the answer kept in memory', () => {
  it('counts as answered after a write that failed', async () => {
    const failing = new MemoryLocationExplanationStore(false);
    failing.writeMode = 'failing';
    const store = rememberingAnswer(failing);

    await expect(store.markAnswered()).rejects.toThrow('fake write failure');

    await expect(store.wasAnswered()).resolves.toBe(true);
    expect(failing.answered).toBe(false);
  });

  it('reads the wrapped store when nothing was answered here', async () => {
    await expect(rememberingAnswer(new MemoryLocationExplanationStore(true)).wasAnswered()).resolves.toBe(true);
    await expect(rememberingAnswer(new MemoryLocationExplanationStore(false)).wasAnswered()).resolves.toBe(false);
  });
});

type LocationPluginOptions = Record<string, unknown>;

function locationPluginOptions(): LocationPluginOptions {
  const plugin = appConfig.plugins?.find((entry) => Array.isArray(entry) && entry[0] === 'expo-location');
  return (plugin as [string, LocationPluginOptions])[1];
}

describe('the iOS « Always » configuration', () => {
  it('enables background location and gives the French reason to the plugin', () => {
    const options = locationPluginOptions();
    const french = appConfig.locales?.fr as Record<string, string>;

    expect(options.isIosBackgroundLocationEnabled).toBe(true);
    expect(options.locationAlwaysAndWhenInUsePermission).toBe(french.NSLocationAlwaysAndWhenInUseUsageDescription);
  });

  it.each([
    ['fr', /2 à 3 minutes après votre scan/],
    ['en', /2 to 3 minutes after your scan/],
  ])('explains « Always » in %s next to the while-in-use reason', (language, reason) => {
    const strings = appConfig.locales?.[language] as Record<string, string>;

    expect(strings.NSLocationWhenInUseUsageDescription).toEqual(expect.any(String));
    expect(strings.NSLocationAlwaysAndWhenInUseUsageDescription).toMatch(reason);
  });

  it('uses the feminine « active » of the screen text in the French reason', () => {
    const french = appConfig.locales?.fr as Record<string, string>;

    expect(french.NSLocationAlwaysAndWhenInUseUsageDescription).toContain('Palier reste active');
  });
});
