import type { GateCommand } from '@palier/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { cursorOf, mergeCommands, pollCommands } from '../../src/http/demo/commandFeed.js';
import { translate } from '../../src/http/demo/consoleText.js';
import type { ApiResponse, GateApi } from '../../src/http/demo/gateApi.js';

const DEVICE_KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
const first: GateCommand = { id: 'command-1', kind: 'OPEN', issuedAt: '2026-10-27T22:02:00.000Z' };
const sameMillisecondA: GateCommand = { id: 'command-2a', kind: 'OPEN', issuedAt: '2026-10-27T22:03:00.000Z' };
const sameMillisecondB: GateCommand = { id: 'command-2b', kind: 'OPEN', issuedAt: '2026-10-27T22:03:00.000Z' };

function fakeApi(response: ApiResponse) {
  return { fetchCommands: vi.fn<GateApi['fetchCommands']>().mockResolvedValue(response) };
}

describe('cursorOf', () => {
  it('starts without a cursor, then follows the last command shown', () => {
    expect(cursorOf([])).toBeNull();
    expect(cursorOf([first, sameMillisecondA])).toBe(sameMillisecondA.issuedAt);
  });
});

describe('mergeCommands', () => {
  it('appends new commands and keeps both commands of one millisecond', () => {
    expect(mergeCommands([first], [sameMillisecondA, sameMillisecondB])).toEqual([first, sameMillisecondA, sameMillisecondB]);
  });

  it('shows a command once when two polls bring it', () => {
    expect(mergeCommands([first, sameMillisecondA], [sameMillisecondA])).toEqual([first, sameMillisecondA]);
  });
});

describe('pollCommands', () => {
  it('asks for the commands after the last one shown and adds them', async () => {
    const api = fakeApi({ status: 200, body: [sameMillisecondA] });

    expect(await pollCommands(api, DEVICE_KEY, [first])).toEqual([first, sameMillisecondA]);
    expect(api.fetchCommands).toHaveBeenCalledWith(DEVICE_KEY, first.issuedAt);
  });

  it('does not call the API until the key has the shape of a device key', async () => {
    const api = fakeApi({ status: 200, body: [first] });

    expect(await pollCommands(api, 'short', [])).toEqual([]);
    expect(api.fetchCommands).not.toHaveBeenCalled();
  });

  it.each([
    ['a refused key', { status: 401, body: null }],
    ['an unreachable API', { status: 0, body: null }],
    ['a body that is not a list', { status: 200, body: { unexpected: true } }],
  ])('keeps the shown commands on %s', async (_case, response) => {
    const known = [first];

    expect(await pollCommands(fakeApi(response), DEVICE_KEY, known)).toBe(known);
  });
});

describe('command line', () => {
  it.each([
    ['fr', 'Ouverture commandée · 18 h 02'],
    ['en', 'Open commanded · 6:02 PM'],
  ] as const)('reads in %s as "%s"', (language, expected) => {
    expect(translate(language, 'commandLine', { command: translate(language, 'commandOPEN'), time: language === 'fr' ? '18 h 02' : '6:02 PM' })).toBe(
      expected,
    );
  });
});
