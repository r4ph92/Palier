import { asDashboardApiError, type DisplayedErrorCode } from '../api/DashboardApiError.ts';

// Reads the list or the map again after a refusal that says the page is out of date.
export type SpotRefusalFollowUp = (code: DisplayedErrorCode) => void;

// Runs a spot write; a refusal is followed up, then still thrown, so the form shows it beside its field or in its summary.
export async function afterRefusal(write: () => Promise<void>, followUp: SpotRefusalFollowUp): Promise<void> {
  try {
    await write();
  } catch (failure) {
    followUp(asDashboardApiError(failure).code);
    throw failure;
  }
}
