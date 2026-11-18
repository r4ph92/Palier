import { screen } from '@testing-library/react-native';
import { HttpParkingSessionClient } from '../src/api/HttpParkingSessionClient';
import { PalierStatusError } from '../src/api/LotsClient';
import { PalierRejectedError } from '../src/api/VehicleClient';
import { parkedAnswerOutcomeOf } from '../src/parkingSessions/parkedAnswerOutcome';
import { FakeParkingSessionClient, julieAtParkingDemo } from './fakeParkingSessionClient';
import { julieWithPanel, pressInPanel, WALKING } from './offlineSignalRig';
import { visibleText } from './visibleText';
import { CONFIRM_TYPED, CORRECTED_SPOT_NUMBER, julieAskedInAisleB, julieCorrecting, NOT_MY_SPOT, WHERE_PARKED } from './whereParkedRig';

const TOO_MANY_FR = 'Trop de tentatives, réessayez dans quelques minutes';
const TOO_MANY_ANSWERS_BODY = { statusCode: 429, error: 'TOO_MANY_PARKED_ANSWERS', message: 'Too many attempts. Try again in a few minutes.' };
const TOO_MANY_SIGNALS_BODY = { statusCode: 429, error: 'TOO_MANY_PARKED_SIGNALS', message: 'Too many attempts. Try again in a few minutes.' };

function clientAnswering(body: unknown, status: number) {
  const fetchFunction = jest.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
  return new HttpParkingSessionClient({ baseUrl: 'http://localhost:3000', token: 'julie-token', onUnauthorized: () => undefined, onConsentRequired: () => undefined, fetchFunction });
}

describe('the parked answer and signal limits in the app (story #126, QA)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 4, 18, 5) }));
  afterEach(() => jest.useRealTimers());

  it('reads the API 429 TOO_MANY_PARKED_ANSWERS body through the real HTTP client as too many attempts', async () => {
    const error = await clientAnswering(TOO_MANY_ANSWERS_BODY, 429).answerParkedSpot('session-1', 'B-3').catch((thrown: unknown) => thrown);

    expect(error).toEqual(new PalierStatusError(429));
    expect(parkedAnswerOutcomeOf(error)).toEqual({ kind: 'problem', problem: 'TOO_MANY_ATTEMPTS' });
  });

  it('reads the API 429 TOO_MANY_PARKED_SIGNALS body as a status error, not a refusal, so the walk is not dropped', async () => {
    const error = await clientAnswering(TOO_MANY_SIGNALS_BODY, 429).reportParked('session-1', { detectedAt: Date.now(), aisleMinor: 2 }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(PalierStatusError);
    expect(error).not.toBeInstanceOf(PalierRejectedError);
  });

  it('lets Julie confirm B-3 again once the limit is over, and then shows « Garé en B-3 »', async () => {
    const { user, parkingSession } = await julieAskedInAisleB();
    parkingSession.answerFailure = new PalierStatusError(429);
    await user.type(screen.getByLabelText('Numéro de place'), 'B-3');
    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));
    expect(await screen.findByRole('alert')).toHaveTextContent(TOO_MANY_FR, visibleText);
    parkingSession.answerFailure = null;

    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));

    expect(await screen.findByText('Garé en B-3', visibleText)).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: WHERE_PARKED })).toBeNull();
    expect(parkingSession.spotAnswers).toEqual(['B-3', 'B-3']);
  });

  it('says « Trop de tentatives » in the correction form too, and keeps the form and the typed number', async () => {
    const { user, parkingSession } = await julieCorrecting();
    parkingSession.answerFailure = new PalierStatusError(429);

    await user.type(screen.getByLabelText(CORRECTED_SPOT_NUMBER), 'A-3');
    await user.press(screen.getByRole('button', { name: CONFIRM_TYPED }));

    expect(await screen.findByRole('alert')).toHaveTextContent(TOO_MANY_FR, visibleText);
    expect(screen.getByRole('header', { name: NOT_MY_SPOT })).toBeOnTheScreen();
    expect(screen.getByLabelText(CORRECTED_SPOT_NUMBER)).toHaveDisplayValue('A-3');
  });

  it('does not report a limited walk signal as an unexpected failure', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const parkingSession = new FakeParkingSessionClient(julieAtParkingDemo());
    const { user } = await julieWithPanel('fr', undefined, parkingSession);
    parkingSession.parkedFailure = new PalierStatusError(429);

    await pressInPanel(user, WALKING);

    expect(parkingSession.parkedReports).toHaveLength(1);
    expect(consoleError).not.toHaveBeenCalledWith('Reporting the walk away from the car failed', expect.anything());
    consoleError.mockRestore();
  });
});
