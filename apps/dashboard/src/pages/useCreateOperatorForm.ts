import { isValidLegalName } from '@palier/shared-types/dashboard';
import { dashboardClient } from '../api/dashboardClient.ts';
import { asDashboardApiError, type DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { useFieldForm, type FieldForm, type FieldValues, type ReadForm } from '../forms/useFieldForm.ts';

type OperatorField = 'legalName';

const EMPTY_OPERATOR: FieldValues<OperatorField> = { legalName: '' };

const FIELD_OF_CODE: Partial<Readonly<Record<DisplayedErrorCode, OperatorField>>> = {
  LEGAL_NAME_INVALID: 'legalName',
};

function readLegalName({ legalName }: FieldValues<OperatorField>): ReadForm<OperatorField, string> {
  return isValidLegalName(legalName) ? { ok: true, value: legalName } : { ok: false, errors: { legalName: 'LEGAL_NAME_INVALID' } };
}

// OPERATOR_EXISTS means the operator was created elsewhere, in another tab say: reading the session shows it.
async function createOperator(legalName: string): Promise<void> {
  try {
    await dashboardClient.createOperator(legalName);
  } catch (failure) {
    if (asDashboardApiError(failure).code !== 'OPERATOR_EXISTS') {
      throw failure;
    }
  }
}

export function useCreateOperatorForm(onCreated: () => Promise<void>): FieldForm<OperatorField> {
  const send = async (legalName: string) => {
    await createOperator(legalName);
    await onCreated();
  };
  return useFieldForm({ initialValues: EMPTY_OPERATOR, read: readLegalName, send, fieldOfCode: FIELD_OF_CODE });
}
