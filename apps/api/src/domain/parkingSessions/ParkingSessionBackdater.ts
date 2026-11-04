export interface ParkingSessionBackdater {
  // Test environments only. Moves the entry scan to enteredAt and the loop confirmation, if any, by the same delta.
  // False when no session has this id or it was cancelled.
  backdateEntry(sessionId: string, enteredAt: Date): Promise<boolean>;
}
