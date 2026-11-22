import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';
import { acceptNoticeAs, authorizationFor, FakeDriverRepository, julie } from './fakeDriverRepository.ts';
import { FakeVehicleRepository } from './fakeVehicleRepository.ts';
import { parkingDemoOnline, repositoryReturning } from './fakes/lotFixtures.ts';
import { fakeGateDependencies, fakeRepositories } from './fakes/serverDependencies.ts';

const LATITUDE = '45.5048';
const LONGITUDE = '-73.5673';

interface LoggedRequest {
  readonly msg: string;
  readonly req?: { readonly method: string; readonly url: string };
}

// A position sent by a modified client must not reach the request log, even though the route refuses it (decision 015).
describe('the request log', () => {
  let server: FastifyInstance;
  let driverRepository: FakeDriverRepository;
  let lines: string[];

  afterEach(() => server.close());

  function startLoggingServer() {
    lines = [];
    driverRepository = new FakeDriverRepository();
    const logStream = { write: (line: string) => lines.push(line) };
    server = buildServer({
      gates: fakeGateDependencies(),
      repositories: fakeRepositories({ vehicleRepository: new FakeVehicleRepository(), lotAvailabilityRepository: repositoryReturning([parkingDemoOnline()]), driverRepository }),
      settings: { logsRequests: true, logStream },
    });
  }

  function incomingRequests(): LoggedRequest[] {
    return lines.map((line) => JSON.parse(line) as LoggedRequest).filter(({ msg }) => msg === 'incoming request');
  }

  it.each([
    { requester: 'Julie, signed in', signedIn: true, url: `/v1/lots?latitude=${LATITUDE}&longitude=${LONGITUDE}`, loggedPath: '/v1/lots' },
    { requester: 'a request without a session', signedIn: false, url: `/v1/lots?latitude=${LATITUDE}&longitude=${LONGITUDE}`, loggedPath: '/v1/lots' },
    { requester: 'a request to an unknown path', signedIn: false, url: `/v1/lots/?latitude=${LATITUDE}&longitude=${LONGITUDE}`, loggedPath: '/v1/lots/' },
  ])('keeps the path of $requester and never the coordinates in its query', async ({ signedIn, url, loggedPath }) => {
    startLoggingServer();
    await acceptNoticeAs(driverRepository, julie);
    const headers = signedIn ? await authorizationFor(driverRepository, julie) : {};

    await server.inject({ method: 'GET', url, headers });

    expect(incomingRequests().map(({ req }) => req)).toEqual([expect.objectContaining({ method: 'GET', url: loggedPath })]);
    expect(lines.join('')).not.toContain(LATITUDE);
    expect(lines.join('')).not.toContain(LONGITUDE);
  });

  it('answers an unknown path with a 404 that does not echo its query', async () => {
    startLoggingServer();

    const response = await server.inject({ method: 'GET', url: `/v1/lots/?latitude=${LATITUDE}` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ statusCode: 404, error: 'Not Found', message: 'Route not found.' });
  });
});
