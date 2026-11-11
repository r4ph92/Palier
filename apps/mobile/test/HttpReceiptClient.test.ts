import { HttpReceiptClient } from '../src/api/HttpReceiptClient';
import { PalierStatusError, PalierUnreachableError } from '../src/api/LotsClient';

const BASE_URL = 'http://localhost:3000';

const summary = { sessionId: 'session-1', lotName: 'Parking Démo', exitedAt: '2026-11-04T21:17:00.000Z', durationMinutes: 195, totalCents: 975 };
const detail = {
  sessionId: 'session-1',
  lotName: 'Parking Démo',
  enteredAt: '2026-11-04T18:02:00.000Z',
  exitedAt: '2026-11-04T21:17:00.000Z',
  durationMinutes: 195,
  increments: 13,
  incrementCents: 75,
  totalCents: 975,
  capped: false,
  lines: [],
  unpaidCents: 0,
  cardLast4: '4242',
};

function clientAnswering(body: unknown, status = 200) {
  const fetchFunction = jest.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
  const client = new HttpReceiptClient({ baseUrl: BASE_URL, token: 'julie-token', onUnauthorized: () => undefined, onConsentRequired: () => undefined, fetchFunction });
  return { client, fetchFunction };
}

describe('listReceipts', () => {
  it('gets the driver’s receipts with the token', async () => {
    const { client, fetchFunction } = clientAnswering({ receipts: [summary] });

    await expect(client.listReceipts()).resolves.toEqual({ receipts: [summary] });
    expect(fetchFunction).toHaveBeenCalledWith(`${BASE_URL}/v1/me/receipts`, expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer julie-token' } }));
  });

  it.each([[{}], [{ receipts: 'none' }], [{ receipts: [{ ...summary, totalCents: '9,75' }] }], [{ receipts: [{ ...summary, exitedAt: 'noon' }] }]])(
    'treats %j as an unreachable Palier',
    async (body) => {
      await expect(clientAnswering(body).client.listReceipts()).rejects.toBeInstanceOf(PalierUnreachableError);
    },
  );
});

describe('findReceipt', () => {
  it('gets one receipt by its session id', async () => {
    const { client, fetchFunction } = clientAnswering({ receipt: detail });

    await expect(client.findReceipt('session-1')).resolves.toEqual({ receipt: detail });
    expect(fetchFunction).toHaveBeenCalledWith(`${BASE_URL}/v1/me/receipts/session-1`, expect.objectContaining({ method: 'GET' }));
  });

  it('reads a receipt without a card', async () => {
    await expect(clientAnswering({ receipt: { ...detail, cardLast4: null } }).client.findReceipt('session-1')).resolves.toMatchObject({ receipt: { cardLast4: null } });
  });

  it('reads the lines and the unpaid balance of a stay over 24 hours', async () => {
    const long = { ...detail, lines: [{ kind: 'DAY', dayNumber: 1, cents: 2500 }, { kind: 'EXTRA', minutes: 360, cents: 1800 }], unpaidCents: 1800 };

    await expect(clientAnswering({ receipt: long }).client.findReceipt('session-1')).resolves.toEqual({ receipt: long });
  });

  it('refuses a receipt without its lines', async () => {
    await expect(clientAnswering({ receipt: { ...detail, lines: undefined } }).client.findReceipt('session-1')).rejects.toBeInstanceOf(PalierUnreachableError);
  });

  it('fails with the status of a 404, as for an unknown or another driver’s receipt', async () => {
    await expect(clientAnswering({ error: 'SESSION_NOT_FOUND' }, 404).client.findReceipt('session-9')).rejects.toBeInstanceOf(PalierStatusError);
  });

  it('refuses a receipt missing its card field', async () => {
    const withoutCard = { ...detail, cardLast4: undefined };

    await expect(clientAnswering({ receipt: withoutCard }).client.findReceipt('session-1')).rejects.toBeInstanceOf(PalierUnreachableError);
  });
});
