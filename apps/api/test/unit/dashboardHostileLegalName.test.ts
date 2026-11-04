import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { nouvelOperateur } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer, writeHeader } from './fakes/dashboardServer.ts';

async function createOperatorNamed(server: FastifyInstance, legalName: string) {
  const cookies = await dashboardCookieFor(server, nouvelOperateur);
  return server.inject({ method: 'POST', url: '/v1/dashboard/operators', cookies, headers: writeHeader, payload: { legalName } });
}

describe('hostile legal names on POST /v1/dashboard/operators', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  // Postgres rejects U+0000 in text, so letting it through turns into a 500 on the lane database.
  it.each([
    ['a NUL character', 'Abc\u0000def'],
    ['only NUL characters', '\u0000\u0000'],
  ])('refuses a legal name holding %s with LEGAL_NAME_INVALID', async (_case, legalName) => {
    server = startDashboardServer().server;

    const response = await createOperatorNamed(server, legalName);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'LEGAL_NAME_INVALID' });
  });

  it('stores an HTML legal name verbatim', async () => {
    server = startDashboardServer().server;
    const legalName = '<b>x</b><script>alert(1)</script>';

    const response = await createOperatorNamed(server, legalName);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ legalName });
  });

  it('stores a 120-character accented legal name', async () => {
    server = startDashboardServer().server;
    const legalName = 'É'.repeat(119) + 'é';

    const response = await createOperatorNamed(server, legalName);

    expect(response.json()).toMatchObject({ legalName });
  });
});
