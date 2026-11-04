import { asDashboardApiError, endsSession, type DisplayedErrorCode } from './DashboardApiError.ts';

// Reads the session again after the action, and after a failure that says the session no longer matches the page.
export async function runThenRefresh(
  action: () => Promise<unknown>,
  refresh: () => Promise<void>,
  refreshAlsoOn: readonly DisplayedErrorCode[] = [],
): Promise<DisplayedErrorCode | null> {
  try {
    await action();
  } catch (failure) {
    const error = asDashboardApiError(failure);
    if (endsSession(error) || refreshAlsoOn.includes(error.code)) {
      await refresh();
    }
    return error.code;
  }
  await refresh();
  return null;
}
