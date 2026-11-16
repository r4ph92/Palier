import type { DashboardSessionDetail } from '@palier/shared-types';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { frSessions } from '../src/i18n/frSessions.ts';
import { installFakeApi, parkingDemo, sophie } from './fakeDashboardApi.ts';
import { OPEN_SESSION_ID, PAID_SESSION_ID, PENDING_SESSION_ID, stepOf, UNPAID_SESSION_ID } from './fakeSessionData.ts';
import { translatedFrenchFragments } from './frenchStrings.ts';
import { renderDashboard } from './renderDashboard.tsx';

const LIST_PAGE = `/lots/${parkingDemo.id}/sessions`;
const sessionPage = (sessionId: string) => `${LIST_PAGE}/${sessionId}`;
const stepTexts = (): string[] => [...document.querySelectorAll('.timeline-label')].map((label) => label.textContent ?? '');

// Every attribute a screen reader or the browser tab reads, beside the text nodes the existing parity test checks.
function readableAttributes(): string[] {
  const attributes = [...document.querySelectorAll('[aria-label], [title], [alt], [placeholder]')].flatMap((element) =>
    ['aria-label', 'title', 'alt', 'placeholder'].map((name) => element.getAttribute(name) ?? ''),
  );
  return [...attributes, document.title].filter((value) => value !== '');
}

function frenchIn(values: readonly string[]): string[] {
  const shown = values.join(' ').replaceAll(parkingDemo.name, '');
  return translatedFrenchFragments().filter((fragment) => shown.includes(fragment));
}

async function openInEnglish(path: string, ready: () => Promise<unknown>) {
  window.localStorage.setItem('palier.language', 'en');
  installFakeApi({ signedInAs: sophie });
  renderDashboard({ path });
  await ready();
}

describe('QA #72: the session pages under attack', () => {
  it('AC1 in English: labels the entry and the exit opening apart, in the order written', async () => {
    await openInEnglish(sessionPage(PAID_SESSION_ID), () => screen.findByRole('heading', { level: 2, name: 'Timeline' }));

    const openings = stepTexts().filter((text) => text.includes('barrier'));
    expect(openings).toEqual(['Entry barrier opened', 'Exit barrier opened']);
    expect(stepTexts().indexOf('Exit barrier opened')).toBeGreaterThan(stepTexts().indexOf('Exit identified (plate)'));
  });

  it.each([
    ['a full visit', PAID_SESSION_ID],
    ['an unpaid balance', UNPAID_SESSION_ID],
    ['a pending capture', PENDING_SESSION_ID],
    ['a vehicle still inside', OPEN_SESSION_ID],
  ])('AC6: leaves no French in the tab title or any aria-label of the session page for %s', async (_, sessionId) => {
    await openInEnglish(sessionPage(sessionId), () => screen.findByRole('heading', { level: 2, name: 'Timeline' }));

    expect(frenchIn(readableAttributes())).toEqual([]);
  });

  it('AC6: leaves no French in the tab title or any aria-label of the sessions list, either filter', async () => {
    await openInEnglish(LIST_PAGE, () => screen.findByRole('table'));
    const openAttributes = readableAttributes();
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    await screen.findByRole('link', { name: 'MGA 315' });

    expect(frenchIn([...openAttributes, ...readableAttributes()])).toEqual([]);
  });

  it('AC6: names every step kind, detail variant and cancellation in English', async () => {
    window.localStorage.setItem('palier.language', 'en');
    const api = installFakeApi({ signedInAs: sophie });
    const visit = api.sessions.get(parkingDemo.id)?.find(({ id }) => id === OPEN_SESSION_ID);
    const timeline = [
      stepOf([1, 'GATE_OPENED', '14:00:00']),
      stepOf([2, 'AISLE_DETECTED', '14:00:01']),
      stepOf([3, 'PARKING_PRESUMED', '14:00:02']),
      stepOf([4, 'PARKING_CONFIRMED', '14:00:03'], { spotNumber: 'B-2' }),
      stepOf([5, 'ENTRY_CANCELLED', '14:00:04'], { reason: 'NO_LOOP' }),
      stepOf([6, 'ENTRY_CANCELLED', '14:00:05'], { reason: 'ADMISSION_FAILED' }),
      stepOf([7, 'ENTRY_CANCELLED', '14:00:06']),
      stepOf([8, 'EXIT_IDENTIFIED', '14:00:07'], { method: 'TRANSPONDER' }),
      stepOf([9, 'EXIT_IDENTIFIED', '14:00:08'], { method: 'BEACON' }),
      stepOf([10, 'CAPTURED', '14:00:09']),
      stepOf([11, 'CAPTURE_PENDING', '14:00:10']),
      stepOf([12, 'UNKNOWN', '14:00:11']),
    ];
    api.sessions.set(parkingDemo.id, [{ id: OPEN_SESSION_ID, detail: { ...(visit?.detail as DashboardSessionDetail), timeline } }]);
    renderDashboard({ path: sessionPage(OPEN_SESSION_ID) });
    await screen.findByRole('heading', { level: 2, name: 'Timeline' });

    expect(stepTexts()).toHaveLength(12);
    expect(frenchIn(stepTexts())).toEqual([]);
  });

  it('renders a hostile plate as text, never as markup', async () => {
    const api = installFakeApi({ signedInAs: sophie });
    const visit = api.sessions.get(parkingDemo.id)?.find(({ id }) => id === PAID_SESSION_ID);
    const plate = '<img src=x onerror=alert(1)><script>alert(2)</script> 🚗 Éé';
    const detail = visit?.detail as DashboardSessionDetail;
    api.sessions.set(parkingDemo.id, [{ id: PAID_SESSION_ID, detail: { ...detail, summary: { ...detail.summary, plate } } }]);
    renderDashboard({ path: sessionPage(PAID_SESSION_ID) });

    expect(await screen.findByRole('heading', { level: 1, name: `Session ${plate}` })).toBeDefined();
    expect(document.querySelectorAll('main img, main script')).toHaveLength(0);
  });

  // Found by QA: « Garée, présumé » and « Garée, confirmé » mix a feminine and a masculine past participle.
  it('agrees the French parked states in gender', () => {
    const parked = [frSessions.states.PARKED_PRESUMED, frSessions.states.PARKED_UNCONFIRMED, frSessions.states.PARKED_CONFIRMED];

    expect(parked.filter((label) => /^Garée, \S+é$/u.test(label))).toEqual([]);
  });
});
