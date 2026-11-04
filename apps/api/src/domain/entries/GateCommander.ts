export interface OpenCommand {
  readonly gateId: string;
  readonly lotId: string;
  readonly sessionId: string;
}

// The gate adapter (D5): a simulated gate records the command for the demo console to show.
export interface GateCommander {
  open(command: OpenCommand): Promise<void>;
}
