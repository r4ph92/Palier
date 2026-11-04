import type { CurrentParkingSession } from '@palier/shared-types';
import { AuthorizedRequester, readJson, type AuthorizedClientOptions } from './authorizedRequest';
import type { ParkingSessionClient } from './ParkingSessionClient';
import { parseCurrentParkingSession } from './parseCurrentParkingSession';

export class HttpParkingSessionClient implements ParkingSessionClient {
  readonly #requester: AuthorizedRequester;

  constructor(options: AuthorizedClientOptions) {
    this.#requester = new AuthorizedRequester(options, new Set());
  }

  async current(): Promise<CurrentParkingSession | null> {
    const response = await this.#requester.send('/v1/me/session', { method: 'GET' });
    return parseCurrentParkingSession(await readJson(response));
  }
}
