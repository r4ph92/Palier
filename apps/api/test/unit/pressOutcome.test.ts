import type { GateIdentity, GatePassageResponse } from '@palier/shared-types';
import { describe, expect, it } from 'vitest';
import { ONLINE, isLoopAvailable } from '../../src/http/demo/offlineControls.js';
import { applyPressOutcome, isKeyInputLocked, loopToFocusAfterPress, patchIfKeyUnchanged } from '../../src/http/demo/pressOutcome.js';
import { messageText, type ConsoleMessage } from '../../src/http/demo/consoleText.js';

const entree: GateIdentity = { id: 'gate-501', name: 'Entrée Démo', kind: 'ENTRY', lotName: 'Parking Démo' };
const sortie: GateIdentity = { id: 'gate-702', name: 'Sortie Démo', kind: 'EXIT', lotName: 'Parking Démo' };
const passage: GatePassageResponse = { closedAt: '2026-11-17T19:03:12.000Z', kind: 'ENTRY', vehicleCount: 4 } as GatePassageResponse;
const ENTREE_KEY = 'entree-key';
const SORTIE_KEY = 'sortie-key';

describe('applyPressOutcome', () => {
  it('shows the identity, the passage and the message of a press whose key is still in the field', () => {
    const patch = applyPressOutcome({ deviceKey: ENTREE_KEY, passages: [] }, ENTREE_KEY, { kind: 'recorded', identity: entree, passage });

    expect(patch.identity).toBe(entree);
    expect(patch.passages).toEqual([passage]);
    expect(patch.message).toMatchObject({ recorded: { vehicleCount: 4 }, isError: false });
  });

  it('keeps the Sortie Démo identity when a stale Entrée Démo answer arrives after the key changed', () => {
    const state = { deviceKey: SORTIE_KEY, passages: [], identity: sortie, connection: ONLINE };

    const patch = applyPressOutcome(state, ENTREE_KEY, { kind: 'wrongLoop', identity: entree });
    const afterwards = { ...state, ...patch };

    expect(afterwards.identity).toBe(sortie);
    expect(isLoopAvailable('EXIT', afterwards)).toBe(true);
    expect(patch.message).toBeUndefined();
  });

  it('keeps the passage the server counted when the key changed meanwhile', () => {
    const patch = applyPressOutcome({ deviceKey: SORTIE_KEY, passages: [] }, ENTREE_KEY, { kind: 'recorded', identity: entree, passage });

    expect(patch).toEqual({ passages: [passage] });
  });

  it.each([
    ['ENTRY', 'wrongLoopENTRY'],
    ['EXIT', 'wrongLoopEXIT'],
  ] as const)('names the %s button when the gate is of that kind', (kind, key) => {
    const identity = kind === 'ENTRY' ? entree : sortie;

    const patch = applyPressOutcome({ deviceKey: ENTREE_KEY, passages: [] }, ENTREE_KEY, { kind: 'wrongLoop', identity });

    expect(patch.message).toEqual({ key, isError: true });
    expect(messageText('fr', patch.message as ConsoleMessage)).toContain(kind === 'ENTRY' ? 'Boucle d’entrée fermée' : 'Boucle de sortie fermée');
  });

  it('announces two passages in a row with different texts', () => {
    const later = { ...passage, closedAt: '2026-11-17T19:03:19.000Z' };
    const first = applyPressOutcome({ deviceKey: ENTREE_KEY, passages: [] }, ENTREE_KEY, { kind: 'recorded', identity: entree, passage });
    const second = applyPressOutcome({ deviceKey: ENTREE_KEY, passages: [] }, ENTREE_KEY, { kind: 'recorded', identity: entree, passage: later });

    expect(messageText('fr', second.message as ConsoleMessage)).not.toBe(messageText('fr', first.message as ConsoleMessage));
  });
});

describe('patchIfKeyUnchanged', () => {
  it('drops a patch built for another key', () => {
    expect(patchIfKeyUnchanged({ deviceKey: SORTIE_KEY }, ENTREE_KEY, { identity: entree })).toEqual({});
    expect(patchIfKeyUnchanged({ deviceKey: ENTREE_KEY }, ENTREE_KEY, { identity: entree })).toEqual({ identity: entree });
  });
});

describe('isKeyInputLocked', () => {
  it('stays open while a press is in flight', () => {
    expect(isKeyInputLocked({ isToggling: false, connection: ONLINE, identity: null })).toBe(false);
  });

  it('locks during an offline toggle', () => {
    expect(isKeyInputLocked({ isToggling: true, connection: ONLINE, identity: null })).toBe(true);
  });

  it('locks while an identified gate is offline', () => {
    const connection = { kind: 'offline', queue: { gateId: 'gate-501', gateName: 'Entrée Démo', kind: 'ENTRY', items: [] } } as const;

    expect(isKeyInputLocked({ isToggling: false, connection, identity: entree })).toBe(true);
    expect(isKeyInputLocked({ isToggling: false, connection, identity: null })).toBe(false);
  });
});

describe('loopToFocusAfterPress', () => {
  it('moves the focus to the enabled loop when a wrong press disabled the pressed one', () => {
    expect(loopToFocusAfterPress('ENTRY', { deviceKey: SORTIE_KEY, identity: sortie, connection: ONLINE })).toBe('EXIT');
    expect(loopToFocusAfterPress('EXIT', { deviceKey: ENTREE_KEY, identity: entree, connection: ONLINE })).toBe('ENTRY');
  });

  it('leaves the focus when the pressed loop is still enabled', () => {
    expect(loopToFocusAfterPress('ENTRY', { deviceKey: ENTREE_KEY, identity: entree, connection: ONLINE })).toBeNull();
  });

  it('leaves the focus when no loop is enabled', () => {
    expect(loopToFocusAfterPress('ENTRY', { deviceKey: '', identity: null, connection: ONLINE })).toBeNull();
  });
});
