import type { frGateErrors } from './frGateErrors.ts';

export const enGateErrors: typeof frGateErrors = {
  GATE_NOT_FOUND: 'This terminal cannot be found. The list of terminals was reloaded.',
  GATE_NAME_REQUIRED: 'Enter the terminal name.',
  GATE_NAME_INVALID: 'The name must be 1 to %{gateNameMaximum} characters, with no invisible characters.',
  GATE_NAME_TAKEN: 'This parking lot already has a terminal with this name.',
  GATE_ENDPOINT_NOT_HTTPS: 'Enter an https address, like https://control.example.com, with no user name or password.',
  GATE_ENDPOINT_REQUIRED: 'The access-control API needs the https address of its controller.',
  GATE_EXIT_ID_ON_ENTRY: 'Only an exit terminal identifies vehicles.',
  GATE_EXIT_LIMIT: 'This parking lot already has its exit terminal. Choose Entry.',
  GATE_LIMIT_REACHED: 'A parking lot has at most %{gatesPerLotMaximum} terminals.',
  GATE_RELOAD_FAILED: 'The list of terminals could not be reloaded after this refusal. Reload the page before trying again.',
};
