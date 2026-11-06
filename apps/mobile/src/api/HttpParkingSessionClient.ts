import type { CurrentParkingSession, ParkedPresumptionResponse } from '@palier/shared-types';
import { AuthorizedRequester, readJson, type AuthorizedClientOptions } from './authorizedRequest';
import type { ParkingSessionClient } from './ParkingSessionClient';
import { parseCurrentParkingSession } from './parseCurrentParkingSession';
import { parseParkedPresumption } from './parseParkedPresumption';

const NOT_FOUND = 404;
const CONFLICT = 409;
const PARKED_REFUSAL_STATUSES = new Set([NOT_FOUND, CONFLICT]);

export class HttpParkingSessionClient implements ParkingSessionClient {
  readonly #requester: AuthorizedRequester;
  readonly #parkedRequester: AuthorizedRequester;

  constructor(options: AuthorizedClientOptions) {
    this.#requester = new AuthorizedRequester(options, new Set());
    this.#parkedRequester = new AuthorizedRequester(options, PARKED_REFUSAL_STATUSES);
  }

  async current(): Promise<CurrentParkingSession | null> {
    const response = await this.#requester.send('/v1/me/session', { method: 'GET' });
    return parseCurrentParkingSession(await readJson(response));
  }

  async reportParked(sessionId: string, detectedAt: number): Promise<ParkedPresumptionResponse> {
    const response = await this.#parkedRequester.send(`/v1/entries/${encodeURIComponent(sessionId)}/parked`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ detectedAt: new Date(detectedAt).toISOString() }),
    });
    return parseParkedPresumption(await readJson(response));
  }
}
