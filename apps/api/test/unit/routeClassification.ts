import { DEMO_ASSETS, demoAssetUrl } from '../../src/http/demo/demoAssets.ts';

// Gated routes refuse a driver who has not accepted the current notice. Exempt routes never check consent.
// The server must register exactly these routes, so a new route fails until it is listed here or in DASHBOARD_ROUTES.
export const GATED = [
  'GET /v1/lots',
  'GET /v1/me/vehicles',
  'POST /v1/me/vehicles',
  'GET /v1/me/vehicles/:id',
  'PATCH /v1/me/vehicles/:id',
  'POST /v1/me/vehicles/:id/default',
  'DELETE /v1/me/vehicles/:id',
  'GET /v1/me/payment-method',
  'PUT /v1/me/payment-method',
  'POST /v1/me/setup-intent',
  'POST /v1/entries',
  'GET /v1/entries/:sessionId',
  'GET /v1/me/session',
  'POST /v1/entries/:sessionId/parked',
  'POST /v1/entries/:sessionId/spot',
  'POST /v1/lots/:id/holds',
  'GET /v1/me/hold',
  'DELETE /v1/holds/:id',
];

// The test routes exist only in test environments and take no driver token.
export const TEST_ROUTES = [
  'GET /v1/test/drivers',
  'POST /v1/test/sign-in',
  'GET /v1/test/clock',
  'PUT /v1/test/clock',
  'DELETE /v1/test/clock',
  'PUT /v1/test/sessions/:sessionId/entered-at',
];

const DRIVER_EXEMPT = ['GET /v1/me', 'POST /v1/consent', 'POST /v1/sign-out', ...TEST_ROUTES];

// Gate controllers sign with a device key, never a driver token: there is no driver whose consent could be checked.
const GATE_DEVICE_ROUTES = ['GET /v1/gates/me', 'GET /v1/gates/me/commands', 'POST /v1/gates/:id/passage'];

// The demo console is static files served only in demo mode; it reaches data through the gate routes with a device key.
const DEMO_CONSOLE_ROUTES = Object.keys(DEMO_ASSETS).map((fileName) => `GET ${demoAssetUrl(fileName)}`);

// Stripe calls the webhook with no driver token and no cookie: its signature is the only credential, checked in the route.
const STRIPE_WEBHOOK_ROUTES = ['POST /v1/stripe/webhook'];

export const EXEMPT = [...DRIVER_EXEMPT, ...GATE_DEVICE_ROUTES, ...DEMO_CONSOLE_ROUTES, ...STRIPE_WEBHOOK_ROUTES];

// Dashboard routes read the dashboard cookie, never a driver token: consent does not apply, a dashboard session does.
export const DASHBOARD_PROTECTED = [
  'GET /v1/dashboard/me',
  'POST /v1/dashboard/operators',
  'GET /v1/dashboard/operators/:id',
  'POST /v1/dashboard/operators/:id/stripe-onboarding',
  'GET /v1/dashboard/lots',
  'GET /v1/dashboard/lots/:id',
];

const DASHBOARD_OPEN = ['POST /v1/dashboard/sign-out', 'GET /v1/dashboard/test/users', 'POST /v1/dashboard/test/sign-in'];

export const DASHBOARD_ROUTES = [...DASHBOARD_PROTECTED, ...DASHBOARD_OPEN];

const SAMPLE_UUID = '00000000-0000-4000-8000-000000000999';

export function methodOf(route: string): string {
  return route.split(' ')[0] ?? '';
}

export function urlOf(route: string): string {
  return (route.split(' ')[1] ?? '').replace(':id', SAMPLE_UUID).replace(':sessionId', SAMPLE_UUID);
}

// Only JSON bodies carry an error code: some routes answer with no body, and the console serves HTML, CSS, scripts and fonts.
export function errorOf(response: { readonly body: string; readonly headers: Readonly<Record<string, unknown>> }): string | undefined {
  const contentType = response.headers['content-type'];
  if (typeof contentType !== 'string' || !contentType.startsWith('application/json')) {
    return undefined;
  }
  return (JSON.parse(response.body) as { error?: string }).error;
}
