import { readTestSignInEnabled } from './environment.ts';
import { stripeTestKey } from './stripeTestKey.ts';

// unreachable: every hold fails as if Stripe were down (#41); success: every hold succeeds without calling Stripe (#42);
// capture-unreachable: holds succeed but every capture fails, so a driver can enter and leave with the capture pending (#50).
export const PAYMENTS_SIMULATIONS = ['none', 'unreachable', 'success', 'capture-unreachable'] as const;

export type PaymentsSimulation = (typeof PAYMENTS_SIMULATIONS)[number];

const RENAMED_SWITCH = 'SIMULATE_STRIPE_UNREACHABLE';

// Test environments only; success is also refused beside a real key, so a lane with Stripe never fakes its holds.
export function readPaymentsSimulation(variables: NodeJS.ProcessEnv): PaymentsSimulation {
  refuseRenamedSwitch(variables);
  const simulation = parseSimulation(variables['PAYMENTS_SIMULATION']);
  if (simulation === 'none') {
    return simulation;
  }
  if (!readTestSignInEnabled(variables)) {
    throw new Error('PAYMENTS_SIMULATION is only allowed when NODE_ENV is development or test.');
  }
  if ((simulation === 'success' || simulation === 'capture-unreachable') && stripeTestKey(variables) !== null) {
    throw new Error(`PAYMENTS_SIMULATION=${simulation} is refused while STRIPE_SECRET_KEY is set: empty the key or the switch.`);
  }
  return simulation;
}

function parseSimulation(rawSimulation: string | undefined): PaymentsSimulation {
  if (rawSimulation === undefined || rawSimulation === '') {
    return 'none';
  }
  const simulation = PAYMENTS_SIMULATIONS.find((candidate) => candidate === rawSimulation);
  if (simulation === undefined) {
    throw new Error(`PAYMENTS_SIMULATION must be one of ${PAYMENTS_SIMULATIONS.join(', ')}, got "${rawSimulation}".`);
  }
  return simulation;
}

// An old .env that still turns the renamed switch on must not start with real payments by surprise.
function refuseRenamedSwitch(variables: NodeJS.ProcessEnv): void {
  const rawSwitch = variables[RENAMED_SWITCH];
  if (rawSwitch !== undefined && rawSwitch !== '' && rawSwitch !== 'false') {
    throw new Error(`${RENAMED_SWITCH} was renamed: use PAYMENTS_SIMULATION=unreachable.`);
  }
}
