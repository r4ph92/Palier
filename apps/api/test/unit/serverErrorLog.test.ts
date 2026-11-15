import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PostgresGateSecretRepository } from '../../src/infrastructure/postgres/PostgresGateSecretRepository.ts';
import { GARAGE_ROY_ID } from '../../src/seed/fixtures/garageRoy.ts';
import { ENTREE_ROY_ID } from '../../src/seed/fixtures/gates.ts';
import { pierre } from './fakes/dashboardFixtures.ts';
import { dashboardCookieFor, startDashboardServer } from './fakes/dashboardServer.ts';
import { lotGateRoutesOf } from './fakes/lotGateRoutes.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const STATEMENT_TIMEOUT = { code: '57014', message: 'canceling statement due to statement timeout' };

interface LoggedError {
  readonly type: string;
  readonly message: string;
  readonly query?: string;
  readonly params?: unknown;
}

describe('the log of a request that failed in Postgres', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  function serverLoggingTo(lines: string[], scripted: ScriptedSql): FastifyInstance {
    const gateSecrets = new PostgresGateSecretRepository(scripted.database());
    const logStream = { write: (line: string) => lines.push(line) };
    ({ server } = startDashboardServer({ testSignInEnabled: true, logsRequests: true, logStream }, { gateSecrets }));
    return server;
  }

  it('keeps the query and the Postgres cause of a failed QR secret replacement, never the secret it carried', async () => {
    const lines: string[] = [];
    const scripted = new ScriptedSql().answer('lock-owned-lot', [{ id: GARAGE_ROY_ID }]).fail('replace-qr-secret', STATEMENT_TIMEOUT);
    serverLoggingTo(lines, scripted);

    const replaced = await lotGateRoutesOf(server).replaceQrSecret(await dashboardCookieFor(server, pierre), ENTREE_ROY_ID);

    expect(replaced.statusCode).toBe(500);
    const secret = String(scripted.statement('replace-qr-secret')?.params[0]);
    expect(secret).toHaveLength(43);
    expect(lines.join('')).not.toContain(secret);
    const logged = lines.map((line) => JSON.parse(line) as { msg: string; err?: LoggedError }).find(({ msg }) => msg === 'request failed');
    expect(logged?.err).toMatchObject({ type: 'FailedQueryError', query: expect.stringMatching(/^update gate set qr_secret = \$1 /) });
    expect(logged?.err?.message).toContain(STATEMENT_TIMEOUT.message);
    expect(logged?.err?.params).toBeUndefined();
  });
});
