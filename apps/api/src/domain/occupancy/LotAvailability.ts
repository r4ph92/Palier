export interface LotAvailability {
  readonly id: string;
  readonly name: string;
  readonly capacity: number;
  readonly vehicleCount: number;
  readonly availableSpotCount: number;
}
