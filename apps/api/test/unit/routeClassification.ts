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

export const EXEMPT = ['GET /v1/me', 'POST /v1/consent', 'POST /v1/sign-out', 'GET /v1/test/drivers', 'POST /v1/test/sign-in'];

const SAMPLE_VEHICLE_ID = '00000000-0000-4000-8000-000000000999';

export function methodOf(route: string): string {
  return route.split(' ')[0] ?? '';
}

export function urlOf(route: string): string {
  return (route.split(' ')[1] ?? '').replace(':id', SAMPLE_VEHICLE_ID);
}

// Some successful routes answer with no body, so an empty body has no error.
export function errorOf(response: { readonly body: string }): string | undefined {
  return response.body === '' ? undefined : (JSON.parse(response.body) as { error?: string }).error;
}
