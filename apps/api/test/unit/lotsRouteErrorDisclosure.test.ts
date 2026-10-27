import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/http/buildServer.ts';

const DATABASE_ERROR_MESSAGE =
  'Failed query: select "parking_lot"."id" from "parking_lot" where "parking_lot"."is_online" = $1\nparams: true';

describe('GET /v1/lots when the database fails', () => {
  let server: FastifyInstance;

  afterEach(() => server.close());

  it('does not reveal the internal error message to the client', async () => {
    server = buildServer({
      lotAvailabilityRepository: { findOnlineLots: () => Promise.reject(new Error(DATABASE_ERROR_MESSAGE)) },
    });

    const response = await server.inject({ method: 'GET', url: '/v1/lots' });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('parking_lot');
    expect(response.body).not.toContain('Failed query');
  });
});
