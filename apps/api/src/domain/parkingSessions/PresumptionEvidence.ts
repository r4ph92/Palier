export const PRESUMPTION_EVIDENCES = ['WALK', 'TIMEOUT'] as const;

export type PresumptionEvidence = (typeof PRESUMPTION_EVIDENCES)[number];
