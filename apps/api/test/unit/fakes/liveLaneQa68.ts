// HTTP helpers for goLiveLiveQa68.test.ts, which runs against a running lane rather than the fakes.
export interface Answer {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

export interface Gate {
  id: string;
  key: string;
}

interface Request {
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
}

const CSRF = { 'x-requested-with': 'palier-dashboard' };
const APP_VERSION = { 'x-palier-app-version': '0.1.0' };

export function callerOf(api: string) {
  const call = async (path: string, request: Request = {}): Promise<Answer> => {
    const headers = { ...request.headers, ...(request.body === undefined ? {} : { 'content-type': 'application/json' }) };
    const body = request.body === undefined ? {} : { body: JSON.stringify(request.body) };
    const response = await fetch(`${api}${path}`, { method: request.method ?? 'GET', headers, ...body });
    const text = await response.text();
    return { status: response.status, body: text === '' ? {} : (JSON.parse(text) as Record<string, unknown>) };
  };
  return {
    call,
    dashboard: (cookie: string) => (method: string, path: string, body?: unknown) => call(`/v1/dashboard${path}`, { method, headers: { cookie, ...CSRF }, body }),
    gate: (gate: Gate, action: string, body?: unknown) => call(`/v1/gates/${gate.id}/${action}`, { method: 'POST', headers: { authorization: `Bearer ${gate.key}` }, body }),
    driver: (token: string) => {
      const headers = { authorization: `Bearer ${token}`, ...APP_VERSION };
      return { get: (path: string) => call(path, { headers }), post: (path: string, body?: unknown) => call(path, { method: 'POST', headers, body }) };
    },
    dashboardCookieOf: async (userId: string): Promise<string> => {
      const response = await fetch(`${api}/v1/dashboard/test/sign-in`, { method: 'POST', headers: { ...CSRF, 'content-type': 'application/json' }, body: JSON.stringify({ userId }) });
      return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    },
  };
}
