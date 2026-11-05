import { describe, expect, it } from 'vitest';
import { readPaymentsSimulation } from '../../src/config/paymentsSimulation.ts';

const testKey = 'sk_test_palier';

describe('readPaymentsSimulation', () => {
  it.each([{}, { PAYMENTS_SIMULATION: '' }, { PAYMENTS_SIMULATION: 'none' }])('simulates nothing by default (%o)', (variables) => {
    expect(readPaymentsSimulation({ NODE_ENV: 'production', ...variables })).toBe('none');
  });

  it.each(['development', 'test'])('accepts both simulations when NODE_ENV is %s', (environment) => {
    expect(readPaymentsSimulation({ NODE_ENV: environment, PAYMENTS_SIMULATION: 'unreachable' })).toBe('unreachable');
    expect(readPaymentsSimulation({ NODE_ENV: environment, PAYMENTS_SIMULATION: 'success' })).toBe('success');
  });

  it.each([
    ['production', { NODE_ENV: 'production' }],
    ['NODE_ENV unset', {}],
  ])('refuses to start with a simulation in %s', (_case, variables) => {
    expect(() => readPaymentsSimulation({ ...variables, PAYMENTS_SIMULATION: 'success' })).toThrow(/only allowed/);
    expect(() => readPaymentsSimulation({ ...variables, PAYMENTS_SIMULATION: 'unreachable' })).toThrow(/only allowed/);
  });

  it('refuses simulated successes beside a real Stripe key', () => {
    expect(() => readPaymentsSimulation({ NODE_ENV: 'development', PAYMENTS_SIMULATION: 'success', STRIPE_SECRET_KEY: testKey })).toThrow(
      /refused while STRIPE_SECRET_KEY is set/,
    );
  });

  it('accepts simulated successes beside the empty key the .env files carry', () => {
    expect(readPaymentsSimulation({ NODE_ENV: 'development', PAYMENTS_SIMULATION: 'success', STRIPE_SECRET_KEY: '' })).toBe('success');
  });

  it('keeps the unreachable simulation beside a real key, so an outage can be rehearsed with Stripe configured', () => {
    expect(readPaymentsSimulation({ NODE_ENV: 'development', PAYMENTS_SIMULATION: 'unreachable', STRIPE_SECRET_KEY: testKey })).toBe('unreachable');
  });

  it.each(['true', 'yes', 'SUCCESS'])('refuses PAYMENTS_SIMULATION=%s', (rawSimulation) => {
    expect(() => readPaymentsSimulation({ NODE_ENV: 'development', PAYMENTS_SIMULATION: rawSimulation })).toThrow(/must be one of none, unreachable, success/);
  });

  it.each(['true', '1'])('refuses to start while the renamed SIMULATE_STRIPE_UNREACHABLE is %s', (rawSwitch) => {
    expect(() => readPaymentsSimulation({ NODE_ENV: 'development', SIMULATE_STRIPE_UNREACHABLE: rawSwitch })).toThrow(
      'SIMULATE_STRIPE_UNREACHABLE was renamed: use PAYMENTS_SIMULATION=unreachable.',
    );
  });

  it.each(['false', ''])('ignores a leftover SIMULATE_STRIPE_UNREACHABLE=%s', (rawSwitch) => {
    expect(readPaymentsSimulation({ NODE_ENV: 'development', SIMULATE_STRIPE_UNREACHABLE: rawSwitch })).toBe('none');
  });
});
