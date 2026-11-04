import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { nouvelOperateur } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';

async function createOperatorNamed(server: FastifyInstance, legalName: string) {
  const cookies = await dashboardCookieFor(server, nouvelOperateur);
  return server.inject({ method: 'POST', url: '/v1/dashboard/operators', cookies, headers: writeHeader, payload: { legalName } });
}

describe('legal names that render blank or differ from what was sent', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  // These are letters or symbols in Unicode, not Cc/Cf, yet they draw nothing: the home title and tab title come out empty.
  it.each([
    ['Hangul fillers', 'ㅤㅤ'],
    ['halfwidth Hangul fillers', 'ﾠﾠ'],
    ['Braille blanks', '⠀⠀'],
    ['combining accents with no base letter', '́́́'],
  ])('refuses a legal name made only of %s with LEGAL_NAME_INVALID', async (_case, legalName) => {
    server = startDashboardServer().server;

    const response = await createOperatorNamed(server, legalName);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'LEGAL_NAME_INVALID' });
  });

  // A newline is refused, so the Unicode line and paragraph separators should be too.
  it.each([
    ['a line separator', 'Abc def'],
    ['a paragraph separator', 'Abc def'],
  ])('refuses a legal name holding %s with LEGAL_NAME_INVALID', async (_case, legalName) => {
    server = startDashboardServer().server;

    const response = await createOperatorNamed(server, legalName);

    expect(response.statusCode).toBe(400);
  });

  // Postgres stores a lone surrogate as U+FFFD, so the operator would be saved under a name nobody typed.
  it('refuses a legal name holding a lone surrogate instead of saving a replacement character', async () => {
    server = startDashboardServer().server;

    const response = await createOperatorNamed(server, '\ud800Abc');

    expect(response.statusCode).toBe(400);
  });
});
