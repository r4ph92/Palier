import { screen } from '@testing-library/react-native';
import { visibleText } from './visibleText';
import { advance, PARKED_IN_A1 } from './walkAwayRig';
import { julieWithPanel, pressInPanel, WALKING } from './offlineSignalRig';

describe('keeping the parking signal across a relaunch of the app (story #26)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('keeps the signal for a relaunch of the app and sends it with the original time once the network is up', async () => {
    const first = await julieWithPanel();
    await pressInPanel(first.user, 'Réseau coupé');
    const beforeWalk = Date.now();
    await pressInPanel(first.user, WALKING);
    first.view.unmount();
    await advance(60_000);

    const relaunched = await julieWithPanel('fr', first.storage);

    expect(relaunched.parkingSession.parkedReports).toEqual([{ sessionId: 'session-1', detectedAt: expect.any(Number), aisleMinor: null }]);
    expect(relaunched.parkingSession.parkedReports[0]?.detectedAt).toBeLessThan(beforeWalk + 4000);
    expect(await screen.findByText(PARKED_IN_A1, visibleText)).toBeOnTheScreen();
    relaunched.view.unmount();
  });
});
