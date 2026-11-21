import type { GateCommand } from '@palier/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { canPollCommands, cursorOf, mergeCommands, pollCommands } from '../../src/http/demo/commandFeed.js';
import { translate } from '../../src/http/demo/consoleText.js';
import type { ApiResponse, GateApi } from '../../src/http/demo/gateApi.js';

const DEVICE_KEY = 'gkXGrHor9PJGFGYu4xrNZ5nMkid18rTHXBmuCuI63as';
const first: GateCommand = { id: 'command-1', kind: 'OPEN', issuedAt: '2026-10-27T22:02:00.000Z', sequence: 1 };
const sameMillisecondA: GateCommand = { id: 'command-2a', kind: 'OPEN', issuedAt: '2026-10-27T22:03:00.000Z', sequence: 2 };
const sameMillisecondB: GateCommand = { id: 'command-2b', kind: 'OPEN', issuedAt: '2026-10-27T22:03:00.000Z', sequence: 3 };
// Issued before sameMillisecondA but committed after it: the gate numbered it later.
const committedLate: GateCommand = { id: 'command-late', kind: 'OPEN', issuedAt: '2026-10-27T22:02:30.000Z', sequence: 4 };

function fakeApi(response: ApiResponse) {
  return { fetchCommands: vi.fn<GateApi['fetchCommands']>().mockResolvedValue(response) };
}

describe('cursorOf', () => {
  it('starts without a cursor, then follows the highest sequence shown', () => {
    expect(cursorOf([])).toBeNull();
    expect(cursorOf([first, sameMillisecondA])).toBe(2);
  });

  it('keeps the highest sequence when a later command was issued earlier', () => {
    expect(cursorOf([first, sameMillisecondA, committedLate])).toBe(4);
  });
});

describe('mergeCommands', () => {
  it('appends new commands and keeps both commands of one millisecond', () => {
    expect(mergeCommands([first], [sameMillisecondA, sameMillisecondB])).toEqual([first, sameMillisecondA, sameMillisecondB]);
  });

  it('shows a command once when two polls bring it', () => {
    expect(mergeCommands([first, sameMillisecondA], [sameMillisecondA])).toEqual([first, sameMillisecondA]);
  });

  it('places each command by its sequence, whatever order the polls answered in', () => {
    expect(mergeCommands([first, sameMillisecondB], [sameMillisecondA])).toEqual([first, sameMillisecondA, sameMillisecondB]);
  });

  it('adds a command committed after the last one shown even though it was issued earlier', () => {
    expect(mergeCommands([first, sameMillisecondA], [committedLate])).toEqual([first, sameMillisecondA, committedLate]);
  });
});

describe('pollCommands', () => {
  it('asks for the commands after the last one shown and adds them', async () => {
    const api = fakeApi({ status: 200, body: [sameMillisecondA] });

    expect(await pollCommands(api, DEVICE_KEY, [first])).toEqual({ commands: [first, sameMillisecondA], isKeyRefused: false });
    expect(api.fetchCommands).toHaveBeenCalledWith(DEVICE_KEY, first.sequence);
  });

  it('asks for the latest commands when none is shown yet', async () => {
    const api = fakeApi({ status: 200, body: [first] });

    expect((await pollCommands(api, DEVICE_KEY, [])).commands).toEqual([first]);
    expect(api.fetchCommands).toHaveBeenCalledWith(DEVICE_KEY, null);
  });

  it('does not call the API until the key can travel in a header', async () => {
    const api = fakeApi({ status: 200, body: [first] });

    expect(await pollCommands(api, 'has a space', [])).toEqual({ commands: [], isKeyRefused: false });
    expect(api.fetchCommands).not.toHaveBeenCalled();
  });

  it.each([
    ['an unreachable API', { status: 0, body: null }],
    ['a body that is not a list', { status: 200, body: { unexpected: true } }],
  ])('keeps the shown commands on %s', async (_case, response) => {
    const known = [first];

    const poll = await pollCommands(fakeApi(response), DEVICE_KEY, known);

    expect(poll.commands).toBe(known);
    expect(poll.isKeyRefused).toBe(false);
  });

  it.each([401, 403])('reports the key as refused on %i and keeps the shown commands', async (status) => {
    const known = [first];

    const poll = await pollCommands(fakeApi({ status, body: null }), DEVICE_KEY, known);

    expect(poll).toEqual({ commands: known, isKeyRefused: true });
    expect(poll.commands).toBe(known);
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

describe('canPollCommands', () => {
  const identity = { id: 'gate-501', name: 'Entrée Démo', kind: 'ENTRY', lotName: 'Parking Démo' } as const;

  it('polls once the key has named its gate', () => {
    expect(canPollCommands({ isPolling: false, connection: { kind: 'online' }, identity })).toBe(true);
  });

  it('never polls for a key still being typed, which has no gate yet', () => {
    expect(canPollCommands({ isPolling: false, connection: { kind: 'online' }, identity: null })).toBe(false);
  });

  it.each([
    ['a poll in flight', { isPolling: true, connection: { kind: 'online' } }],
    ['an offline console', { isPolling: false, connection: { kind: 'offline' } }],
  ])('does not poll with %s', (_case, state) => {
    expect(canPollCommands({ ...state, identity })).toBe(false);
  });
});
