// What made a session presumed parked: the driver walking in the aisle, or thirty minutes of silence (decision 023).
export const PRESUMPTION_EVIDENCES = ['WALK', 'TIMEOUT'] as const;

export type PresumptionEvidence = (typeof PRESUMPTION_EVIDENCES)[number];
