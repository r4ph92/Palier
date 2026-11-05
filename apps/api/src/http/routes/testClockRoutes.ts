import type { BackdateParkingSessionRequest, TestClockReading } from '@palier/shared-types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ParkingSessionBackdater } from '../../domain/parkingSessions/ParkingSessionBackdater.ts';
import type { TestClock } from '../../domain/time/TestClock.ts';
import { entrySessionParametersSchema, type EntrySessionParameters } from '../schemas/entrySchemas.ts';
import { backdateParkingSessionSchema, testClockReadingSchema } from '../schemas/parkingSessionSchemas.ts';

const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const EARLIEST_ENTRY = new Date(0);

export interface TestClockRouteDependencies {
  readonly testClock: TestClock;
  readonly backdater: ParkingSessionBackdater;
}

interface SetClockRoute {
  readonly Body: TestClockReading;
}

interface BackdateRoute {
  readonly Params: EntrySessionParameters;
  readonly Body: BackdateParkingSessionRequest;
}

// Registered with the test sign-in, only in test environments; no driver token, like the test sign-in itself.
// Only the current-session routes and the spot hold routes (place, read, release) read this clock: gates and SQL now() keep real time.
export function registerTestClockRoutes(server: FastifyInstance, { testClock, backdater }: TestClockRouteDependencies): void {
  const response = { 200: testClockReadingSchema };
  server.get('/v1/test/clock', { schema: { response } }, () => readingOf(testClock));
  server.put<SetClockRoute>('/v1/test/clock', { schema: { body: testClockReadingSchema, response } }, (request, reply) =>
    setClock(testClock, request, reply),
  );
  server.delete('/v1/test/clock', { schema: { response } }, () => {
    testClock.useRealTime();
    return readingOf(testClock);
  });
  server.put<BackdateRoute>(
    '/v1/test/sessions/:sessionId/entered-at',
    { schema: { params: entrySessionParametersSchema, body: backdateParkingSessionSchema } },
    (request, reply) => backdate({ testClock, backdater }, request, reply),
  );
}

// The schema's date-time format admits a leap second, which Date cannot hold.
function refuseInstant(reply: FastifyReply): FastifyReply {
  return reply.status(BAD_REQUEST).send({ statusCode: BAD_REQUEST, error: 'Bad Request', message: 'The instant is not a valid date.' });
}

function readingOf(testClock: TestClock): TestClockReading {
  return { now: testClock.now().toISOString() };
}

function setClock(testClock: TestClock, request: FastifyRequest<SetClockRoute>, reply: FastifyReply): TestClockReading | FastifyReply {
  const instant = new Date(request.body.now);
  if (Number.isNaN(instant.getTime())) {
    return refuseInstant(reply);
  }
  testClock.setFixed(instant);
  return readingOf(testClock);
}

async function backdate(
  { testClock, backdater }: TestClockRouteDependencies,
  request: FastifyRequest<BackdateRoute>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const enteredAt = new Date(request.body.enteredAt);
  if (Number.isNaN(enteredAt.getTime())) {
    return refuseInstant(reply);
  }
  const refusal = backdateRefusal(enteredAt, testClock.now());
  if (refusal !== null) {
    return reply.status(BAD_REQUEST).send({ statusCode: BAD_REQUEST, ...refusal });
  }
  if (!(await backdater.backdateEntry(request.params.sessionId, enteredAt))) {
    return reply.status(NOT_FOUND).send({ statusCode: NOT_FOUND, error: 'SESSION_NOT_FOUND', message: 'No such session.' });
  }
  return reply.status(NO_CONTENT).send();
}

interface BackdateRefusal {
  readonly error: 'ENTERED_AT_TOO_EARLY' | 'ENTERED_AT_IN_FUTURE';
  readonly message: string;
}

// Before 1970 the database driver reads timestamps back wrong (year 0001 comes back as 2001).
function backdateRefusal(enteredAt: Date, now: Date): BackdateRefusal | null {
  if (enteredAt < EARLIEST_ENTRY) {
    return { error: 'ENTERED_AT_TOO_EARLY', message: 'enteredAt is before 1970-01-01.' };
  }
  if (enteredAt > now) {
    return { error: 'ENTERED_AT_IN_FUTURE', message: 'enteredAt is later than the clock.' };
  }
  return null;
}
