// Leaves the dashboard for another site, Stripe's hosted onboarding. A function of its own so tests can watch the redirect.
export function redirectTo(url: string): void {
  window.location.assign(url);
}
