import { DEMO_ASSETS, demoAssetUrl } from '../../src/http/demo/demoAssets.ts';

// Gated routes refuse a driver who has not accepted the current notice. Exempt routes never check consent.
// The server must register exactly these routes, so a new route fails until it is listed in one of the two lists.
export const GATED = [
  'GET /v1/lots',
  'GET /v1/me/vehicles',
  'POST /v1/me/vehicles',
  'GET /v1/me/vehicles/:id',
  'POST /v1/me/vehicles/:id/default',
  'DELETE /v1/me/vehicles/:id',
  'GET /v1/me/payment-method',
  'PUT /v1/me/payment-method',
  'POST /v1/me/setup-intent',
];

const DRIVER_EXEMPT = ['GET /v1/me', 'POST /v1/consent', 'POST /v1/sign-out', 'GET /v1/test/drivers', 'POST /v1/test/sign-in'];

// Gate controllers sign with a device key, never a driver token: there is no driver whose consent could be checked.
const GATE_DEVICE_ROUTES = ['GET /v1/gates/me', 'POST /v1/gates/:id/passage'];

// The demo console is static files served only in demo mode; it reaches data through the gate routes with a device key.
const DEMO_CONSOLE_ROUTES = Object.keys(DEMO_ASSETS).map((fileName) => `GET ${demoAssetUrl(fileName)}`);

export const EXEMPT = [...DRIVER_EXEMPT, ...GATE_DEVICE_ROUTES, ...DEMO_CONSOLE_ROUTES];

const SAMPLE_VEHICLE_ID = '00000000-0000-4000-8000-000000000999';

export function methodOf(route: string): string {
  return route.split(' ')[0] ?? '';
}

export function urlOf(route: string): string {
  return (route.split(' ')[1] ?? '').replace(':id', SAMPLE_VEHICLE_ID);
}

// Only JSON bodies carry an error code: some routes answer with no body, and the console serves HTML, CSS, scripts and fonts.
export function errorOf(response: { readonly body: string; readonly headers: Readonly<Record<string, unknown>> }): string | undefined {
  const contentType = response.headers['content-type'];
  if (typeof contentType !== 'string' || !contentType.startsWith('application/json')) {
    return undefined;
  }
  return (JSON.parse(response.body) as { error?: string }).error;
}
