import type { SpotHold } from '@palier/shared-types';
import { AuthorizedRequester, readJson, type AuthorizedClientOptions } from './authorizedRequest';
import { parseCurrentSpotHold, parseSpotHold } from './parseSpotHold';
import type { SpotHoldClient } from './SpotHoldClient';

const NOT_FOUND = 404;
const CONFLICT = 409;
const TOO_MANY_REQUESTS = 429;
const SERVICE_UNAVAILABLE = 503;
const SPOT_HOLD_REFUSAL_STATUSES = new Set([NOT_FOUND, CONFLICT, TOO_MANY_REQUESTS, SERVICE_UNAVAILABLE]);

export class HttpSpotHoldClient implements SpotHoldClient {
  readonly #holdRequester: AuthorizedRequester;
  readonly #currentRequester: AuthorizedRequester;

  constructor(options: AuthorizedClientOptions) {
    this.#holdRequester = new AuthorizedRequester(options, SPOT_HOLD_REFUSAL_STATUSES);
    this.#currentRequester = new AuthorizedRequester(options, new Set());
  }

  async hold(lotId: string): Promise<SpotHold> {
    const response = await this.#holdRequester.send(`/v1/lots/${encodeURIComponent(lotId)}/holds`, { method: 'POST' });
    return parseSpotHold(await readJson(response));
  }

  async current(): Promise<SpotHold | null> {
    const response = await this.#currentRequester.send('/v1/me/hold', { method: 'GET' });
    return parseCurrentSpotHold(await readJson(response));
  }
}
