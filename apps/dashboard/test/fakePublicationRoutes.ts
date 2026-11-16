import type { Attestation, LotPublication } from '@palier/shared-types';
import { type FakeApiState, type FakeResponse, refused } from './fakeDashboardData.ts';
import { publicationOf } from './fakePublicationData.ts';

const PUBLICATION_REQUEST = /^(GET \/lots\/([^/]+)\/publication|PUT \/lots\/([^/]+)\/(online|attestations\/wifi|attestations\/cellular))$/;

export function isPublicationRequest(request: string): boolean {
  return PUBLICATION_REQUEST.test(request);
}

interface PublicationContext {
  readonly state: FakeApiState;
  readonly ownedLotIds: ReadonlySet<string>;
}

// Only a member's own lot answers, and putting it online re-checks the list, as in the API.
export function routePublication({ state, ownedLotIds }: PublicationContext, request: string, body: Record<string, unknown>): FakeResponse {
  const [, , readLotId, writtenLotId, write] = PUBLICATION_REQUEST.exec(request) ?? [];
  const lotId = readLotId ?? writtenLotId ?? '';
  const publication = ownedLotIds.has(lotId) ? state.publication.get(lotId) : undefined;
  if (publication === undefined) {
    return refused(404, 'LOT_NOT_FOUND');
  }
  const written = write === undefined ? publication : writtenPublication(publication, write, body);
  if (written === null) {
    return refused(409, 'LOT_NOT_READY');
  }
  state.publication.set(lotId, written);
  return { status: 200, body: written };
}

function writtenPublication(publication: LotPublication, write: string, body: Record<string, unknown>): LotPublication | null {
  if (write === 'online') {
    const online = body['online'] === true;
    return online && publication.missing.length > 0 ? null : { ...publication, isOnline: online };
  }
  const attestation = body as unknown as Attestation;
  const facts = write === 'attestations/wifi' ? { ...publication, wifi: attestation } : { ...publication, cellular: attestation };
  return publicationOf(facts);
}
