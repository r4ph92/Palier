import { isValidLegalName } from '@palier/shared-types/dashboard';
import { useState, type FormEvent } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { runThenRefresh } from '../api/runThenRefresh.ts';

export interface CreateOperatorForm {
  readonly legalName: string;
  readonly setLegalName: (legalName: string) => void;
  readonly submitting: boolean;
  readonly error: DisplayedErrorCode | null;
  readonly submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

// OPERATOR_EXISTS means the operator was created elsewhere, in another tab say: reading the session shows it.
function createThenRefresh(legalName: string, onCreated: () => Promise<void>): Promise<DisplayedErrorCode | null> {
  return runThenRefresh(() => dashboardClient.createOperator(legalName), onCreated, ['OPERATOR_EXISTS']);
}

interface LegalNameField {
  readonly legalName: string;
  readonly setLegalName: (legalName: string) => void;
  readonly error: DisplayedErrorCode | null;
  readonly setError: (error: DisplayedErrorCode | null) => void;
}

// Any edit clears the error, so a corrected name never sits next to the old complaint.
function useLegalNameField(): LegalNameField {
  const [legalName, setLegalNameState] = useState('');
  const [error, setError] = useState<DisplayedErrorCode | null>(null);
  const setLegalName = (value: string) => {
    setLegalNameState(value);
    setError(null);
  };
  return { legalName, setLegalName, error, setError };
}

// The same rule as the API, checked first so a short name is refused without a round trip; the API still decides.
export function useCreateOperatorForm(onCreated: () => Promise<void>): CreateOperatorForm {
  const { legalName, setLegalName, error, setError } = useLegalNameField();
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    if (!isValidLegalName(legalName)) {
      setError('LEGAL_NAME_INVALID');
      return;
    }
    setError(null);
    setSubmitting(true);
    setError(await createThenRefresh(legalName, onCreated));
    setSubmitting(false);
  };
  return { legalName, setLegalName, submitting, error, submit };
}
