import { HttpParkingSessionClient } from '../src/api/HttpParkingSessionClient';
import {
  PalierStatusError,
  PalierUnreachableError,
} from '../src/api/LotsClient';
import { PalierRejectedError } from '../src/api/VehicleClient';

const BASE_URL = 'http://localhost:3000';

function clientAnswering(body: unknown, status = 200) {
  const fetchFunction = jest.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
  const client = new HttpParkingSessionClient({
    baseUrl: BASE_URL,
    token: 'julie-token',
    onUnauthorized: () => undefined,
    onConsentRequired: () => undefined,
    fetchFunction,
  });
  return { client, fetchFunction };
}

describe('exit (story #47)', () => {
  const receipt = {
    exitedAt: '2026-11-04T21:17:00.000Z',
    durationMinutes: 195,
    increments: 13,
    incrementCents: 75,
    totalCents: 975,
    capped: false,
    lines: [],
    unpaidCents: 0,
  };

  it('posts the tap for the session and reads the receipt', async () => {
    const { client, fetchFunction } = clientAnswering({ receipt });

    await expect(client.exit('session-1')).resolves.toEqual({ receipt });
    expect(fetchFunction).toHaveBeenCalledWith(
      `${BASE_URL}/v1/entries/session-1/exit`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('reads a null receipt when the barrier opened and the capture is pending', async () => {
    const { client } = clientAnswering({ receipt: null });

    await expect(client.exit('session-1')).resolves.toEqual({ receipt: null });
  });

  it.each([
    [404, 'SESSION_NOT_FOUND'],
    [409, 'SESSION_CLOSED'],
    [409, 'ENTRY_NOT_CONFIRMED'],
  ])('rejects a %i with the code %s', async (status, error) => {
    await expect(
      clientAnswering({ statusCode: status, error }, status).client.exit(
        'session-1',
      ),
    ).rejects.toEqual(new PalierRejectedError(error));
  });

  it.each([['PAYMENTS_UNAVAILABLE'], ['GATE_UNAVAILABLE'], ['LOT_BUSY']])(
    'rejects a 503 %s by its status, like no answer',
    async (error) => {
      await expect(
        clientAnswering({ error }, 503).client.exit('session-1'),
      ).rejects.toBeInstanceOf(PalierStatusError);
    },
  );

  it('reads the lines and the unpaid balance of a stay over 24 hours', async () => {
    const long = {
      ...receipt,
      durationMinutes: 1800,
      totalCents: 2500,
      lines: [
        { kind: 'DAY', dayNumber: 1, cents: 2500 },
        { kind: 'EXTRA', minutes: 360, cents: 1800 },
      ],
      unpaidCents: 1800,
    };

    await expect(clientAnswering({ receipt: long }).client.exit('session-1')).resolves.toEqual({ receipt: long });
  });

  it.each([
    ['no receipt', {}],
    ['no lines', { receipt: { ...receipt, lines: undefined } }],
    ['a line of an unknown kind', { receipt: { ...receipt, lines: [{ kind: 'WEEK', cents: 100 }] } }],
    ['an unpaid balance that is not a number', { receipt: { ...receipt, unpaidCents: '18,00' } }],
    [
      'a total that is not a number',
      { receipt: { ...receipt, totalCents: '9,75' } },
    ],
    ['a negative duration', { receipt: { ...receipt, durationMinutes: -1 } }],
    ['a missing capped flag', { receipt: { ...receipt, capped: undefined } }],
  ])('treats %s as no answer', async (_case, body) => {
    await expect(
      clientAnswering(body).client.exit('session-1'),
    ).rejects.toBeInstanceOf(PalierUnreachableError);
  });
});
