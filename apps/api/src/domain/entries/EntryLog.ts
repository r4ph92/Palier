import type { FastifyBaseLogger } from 'fastify';

export type EntryLog = Pick<FastifyBaseLogger, 'warn' | 'error'>;
