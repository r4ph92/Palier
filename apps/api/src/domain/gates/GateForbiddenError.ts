// A device key used on another gate's path, whatever the route: passage, exit, heartbeat or battery report.
export class GateForbiddenError extends Error {
  readonly reason = 'GATE_FORBIDDEN';

  constructor() {
    super('This device key does not belong to this gate.');
    this.name = 'GateForbiddenError';
  }
}
