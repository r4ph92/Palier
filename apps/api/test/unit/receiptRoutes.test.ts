import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PaidSession } from '../../src/domain/receipts/ReceiptRepository.ts';
import { SESSION_NOT_FOUND_BODY } from '../../src/http/sessionNotFound.ts';
import { configureServer } from './configureServer.ts';
import { acceptNoticeAs, authorizationFor, julie, marc } from './fakeDriverRepository.ts';

const PRICING = { incrementCents: 75, incrementMinutes: 15, dailyCapCents: 2500 };
const UNKNOWN_ID = '00000000-0000-4000-8000-0000000000ff';

interface PaidSessionFacts {
  readonly id: string;
  readonly enteredAt: string;
  readonly exitedAt: string;
  readonly capturedCents: number;
  readonly cardLast4?: string | null;
}

function paidSession({ id, enteredAt, exitedAt, capturedCents, cardLast4 = '4242' }: PaidSessionFacts): PaidSession {
  return { id, lotName: 'Parking Démo', enteredAt: new Date(enteredAt), pricing: PRICING, exit: { exitedAt: new Date(exitedAt), capturedCents }, cardLast4 };
}

const monday = paidSession({ id: '00000000-0000-4000-8000-000000000a01', enteredAt: '2026-11-02T14:00:00Z', exitedAt: '2026-11-02T15:00:00Z', capturedCents: 300 });
const tuesday = paidSession({ id: '00000000-0000-4000-8000-000000000a02', enteredAt: '2026-11-03T14:00:00Z', exitedAt: '2026-11-03T17:15:00Z', capturedCents: 975 });
const wednesday = paidSession({ id: '00000000-0000-4000-8000-000000000a03', enteredAt: '2026-11-04T14:00:00Z', exitedAt: '2026-11-04T23:00:00Z', capturedCents: 2500 });

describe('driver receipts', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  async function julieWithThreeReceipts() {
    const configured = configureServer();
    server = configured.server;
    [monday, wednesday, tuesday].forEach((session) => configured.receipts.add(julie.id, session));
    await acceptNoticeAs(configured.driverRepository, julie);
    await acceptNoticeAs(configured.driverRepository, marc);
    const julieHeaders = await authorizationFor(configured.driverRepository, julie);
    const marcHeaders = await authorizationFor(configured.driverRepository, marc);
    const get = (url: string, headers: Record<string, string> = julieHeaders) => server.inject({ method: 'GET', url, headers });
    return { ...configured, get, marcHeaders };
  }

  describe('GET /v1/me/receipts', () => {
    it('lists Julie’s 3 receipts, newest first, with lot, date, duration and total', async () => {
      const { get } = await julieWithThreeReceipts();

      const response = await get('/v1/me/receipts');

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        receipts: [
          { sessionId: wednesday.id, lotName: 'Parking Démo', exitedAt: '2026-11-04T23:00:00.000Z', durationMinutes: 540, totalCents: 2500 },
          { sessionId: tuesday.id, lotName: 'Parking Démo', exitedAt: '2026-11-03T17:15:00.000Z', durationMinutes: 195, totalCents: 975 },
          { sessionId: monday.id, lotName: 'Parking Démo', exitedAt: '2026-11-02T15:00:00.000Z', durationMinutes: 60, totalCents: 300 },
        ],
      });
    });

    it('lists nothing for Marc, who has no closed session, whatever Julie has', async () => {
      const { get, marcHeaders } = await julieWithThreeReceipts();

      const response = await get('/v1/me/receipts', marcHeaders);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ receipts: [] });
    });

    it('refuses a request without a token', async () => {
      const { get } = await julieWithThreeReceipts();

      expect((await get('/v1/me/receipts', {})).statusCode).toBe(401);
    });
  });

  describe('GET /v1/me/receipts/:sessionId', () => {
    it('shows entry and exit times, the price per increment, the increments, the total and the card’s last four', async () => {
      const { get } = await julieWithThreeReceipts();

      const response = await get(`/v1/me/receipts/${tuesday.id}`);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        receipt: {
          sessionId: tuesday.id,
          lotName: 'Parking Démo',
          enteredAt: '2026-11-03T14:00:00.000Z',
          exitedAt: '2026-11-03T17:15:00.000Z',
          durationMinutes: 195,
          increments: 13,
          incrementCents: 75,
          totalCents: 975,
          capped: false,
          cardLast4: '4242',
        },
      });
    });

    it('marks a receipt held under increments × price by the daily cap', async () => {
      const { get } = await julieWithThreeReceipts();

      const response = await get(`/v1/me/receipts/${wednesday.id}`);

      expect(response.json()).toMatchObject({ receipt: { increments: 36, totalCents: 2500, capped: true } });
    });

    it('answers a null card for a session opened before the card was recorded', async () => {
      const { get, receipts } = await julieWithThreeReceipts();
      const old = paidSession({ id: '00000000-0000-4000-8000-000000000a04', enteredAt: '2026-10-01T14:00:00Z', exitedAt: '2026-10-01T15:00:00Z', capturedCents: 300, cardLast4: null });
      receipts.add(julie.id, old);

      const response = await get(`/v1/me/receipts/${old.id}`);

      expect(response.json()).toMatchObject({ receipt: { cardLast4: null } });
    });

    it('answers not found when Marc asks for Julie’s receipt, like an unknown id', async () => {
      const { get, marcHeaders } = await julieWithThreeReceipts();

      const julies = await get(`/v1/me/receipts/${tuesday.id}`, marcHeaders);
      const unknown = await get(`/v1/me/receipts/${UNKNOWN_ID}`, marcHeaders);

      expect(julies.statusCode).toBe(404);
      expect(julies.json()).toEqual(SESSION_NOT_FOUND_BODY);
      expect(unknown.statusCode).toBe(404);
      expect(unknown.json()).toEqual(julies.json());
    });

    it('refuses an id that is not a UUID and a request without a token', async () => {
      const { get } = await julieWithThreeReceipts();

      expect((await get('/v1/me/receipts/not-a-uuid')).statusCode).toBe(400);
      expect((await get(`/v1/me/receipts/${tuesday.id}`, {})).statusCode).toBe(401);
    });
  });
});
