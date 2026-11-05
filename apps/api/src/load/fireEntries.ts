import type { EntryRefusalBody, EntryRefusalCode } from '@palier/shared-types';
import { APP_VERSION_HEADER } from '@palier/shared-types/appVersion';

export interface EntryRequestTarget {
  readonly apiUrl: URL;
  readonly qrContent: string;
  readonly appVersion: string;
}

export const ADMITTED = 'ADMITTED';
export const UNREACHABLE = 'UNREACHABLE';

// HTTP_<status> for an answer whose body carries no refusal code.
export type EntryAnswer = typeof ADMITTED | EntryRefusalCode | `HTTP_${number}` | typeof UNREACHABLE;

export interface EntryOutcome {
  readonly answer: EntryAnswer;
  readonly spot: string | null;
  readonly latencyMilliseconds: number;
}

const CREATED = 201;

interface EntryAnswerBody extends Partial<Pick<EntryRefusalBody, 'error'>> {
  readonly spot?: { readonly levelCode?: unknown; readonly number?: unknown };
}

// Every request is built first and sent in the same tick, so the API sees the scans arrive together.
export function fireEntries(target: EntryRequestTarget, driverTokens: readonly string[]): Promise<EntryOutcome[]> {
  const url = new URL('/v1/entries', target.apiUrl);
  return Promise.all(driverTokens.map((token) => timedEntry(url, requestFor(target, token))));
}

function requestFor({ qrContent, appVersion }: EntryRequestTarget, token: string): RequestInit {
  return {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', [APP_VERSION_HEADER]: appVersion },
    body: JSON.stringify({ qrContent }),
  };
}

async function timedEntry(url: URL, request: RequestInit): Promise<EntryOutcome> {
  const startedAt = performance.now();
  const outcome = await answerTo(url, request);
  return { ...outcome, latencyMilliseconds: Math.round(performance.now() - startedAt) };
}

async function answerTo(url: URL, request: RequestInit): Promise<Omit<EntryOutcome, 'latencyMilliseconds'>> {
  try {
    const response = await fetch(url, request);
    const body = (await response.json().catch(() => ({}))) as EntryAnswerBody;
    if (response.status === CREATED) {
      return { answer: ADMITTED, spot: `${String(body.spot?.levelCode)} ${String(body.spot?.number)}` };
    }
    return { answer: body.error ?? `HTTP_${response.status}`, spot: null };
  } catch {
    return { answer: UNREACHABLE, spot: null };
  }
}
