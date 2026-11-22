import { DrizzleQueryError } from 'drizzle-orm/errors';
import type { FastifyRequest, FastifyServerOptions } from 'fastify';

export interface LogStream {
  write(line: string): void;
}

export interface ServerLogging {
  readonly logsRequests?: boolean | undefined;
  // Where the lines go; standard output when absent.
  readonly logStream?: LogStream | undefined;
}

type LoggerOptions = Exclude<NonNullable<FastifyServerOptions['logger']>, boolean>;
type LogMethodHook = NonNullable<NonNullable<LoggerOptions['hooks']>['logMethod']>;

// Every logger of the server, request loggers included, goes through the hook before its serializers.
export function serverLoggerOf({ logsRequests = false, logStream }: ServerLogging): LoggerOptions | false {
  if (!logsRequests) {
    return false;
  }
  return {
    ...(logStream === undefined ? {} : { stream: logStream }),
    hooks: { logMethod: withoutQueryParametersHook },
    serializers: { req: requestWithoutQueryString },
  };
}

// Fastify's default request line prints the whole URL: a query string, a position sent by a modified client included,
// would reach the log even when the route refuses it (decision 015). Only the path is kept.
function requestWithoutQueryString(request: FastifyRequest) {
  return {
    method: request.method,
    url: request.url.replace(/[?#].*$/s, ''),
    host: request.host,
    remoteAddress: request.ip,
  };
}

const withoutQueryParametersHook: LogMethodHook = function (args, method) {
  const [fields, ...rest] = args;
  method.apply(this, [loggableFieldsOf(fields), ...rest] as Parameters<typeof method>);
};

function loggableFieldsOf(fields: unknown): unknown {
  if (typeof fields !== 'object' || fields === null || !('err' in fields) || !(fields.err instanceof DrizzleQueryError)) {
    return fields;
  }
  return { ...fields, err: new FailedQueryError(fields.err) };
}

// Drizzle writes a failed query's parameters, a gate's QR secret among them, into its message, its stack and its params:
// the log keeps the query text, with $1 placeholders, and the Postgres error that caused it.
class FailedQueryError extends Error {
  readonly query: string;

  constructor({ query, cause }: DrizzleQueryError) {
    super(`Failed query: ${query}`, { cause });
    this.query = query;
    this.stack = `${this.name}: ${this.message}`;
  }
}
