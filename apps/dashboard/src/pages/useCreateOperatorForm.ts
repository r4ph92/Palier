import { isValidLegalName } from '@palier/shared-types/dashboard';
import { useState, type FormEvent } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { asDashboardApiError, type DisplayedErrorCode } from '../api/DashboardApiError.ts';

async function createThenRefresh(legalName: string, onCreated: () => Promise<void>): Promise<DisplayedErrorCode | null> {
  try {
    await dashboardClient.createOperator(legalName);
    await onCreated();
    return null;
  } catch (failure) {
    return asDashboardApiError(failure).code;
  }
}

// The same rule as the API, checked first so a short name is refused without a round trip; the API still decides.
export function useCreateOperatorForm(onCreated: () => Promise<void>) {
  const [legalName, setLegalName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<DisplayedErrorCode | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidLegalName(legalName)) {
      setError('LEGAL_NAME_INVALID');
      return;
    }
    setSubmitting(true);
    const failure = await createThenRefresh(legalName, onCreated);
    setError(failure);
    setSubmitting(false);
  };
  return { legalName, setLegalName, submitting, error, submit };
}
