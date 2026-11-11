import { lotDraftErrors, type LotDraft, type LotDraftErrorCode, type LotDraftField } from '@palier/shared-types/lotDraft';
import { dashboardClient } from '../api/dashboardClient.ts';
import { readFormOf, useFieldForm, type FieldForm, type FieldValues, type ReadForm } from '../forms/useFieldForm.ts';
import { useNavigation } from '../navigation/NavigationContext.tsx';
import { lotPath } from '../navigation/routes.ts';
import { numberOrNaN, parseDecimal, parseWholeNumber } from './parseNumbers.ts';

const EMPTY_DRAFT: FieldValues<LotDraftField> = { name: '', address: '', latitude: '', longitude: '', capacity: '' };

const FIELD_OF_CODE: Readonly<Record<LotDraftErrorCode, LotDraftField>> = {
  LOT_NAME_INVALID: 'name',
  LOT_ADDRESS_INVALID: 'address',
  LOT_COORDINATES_INVALID: 'latitude',
  LOT_CAPACITY_INVALID: 'capacity',
};

// Unreadable numbers become NaN, which the shared rule refuses on their own field.
function readLotDraft(values: FieldValues<LotDraftField>): ReadForm<LotDraftField, LotDraft> {
  const draft: LotDraft = {
    name: values.name,
    address: values.address,
    latitude: numberOrNaN(parseDecimal(values.latitude)),
    longitude: numberOrNaN(parseDecimal(values.longitude)),
    capacity: numberOrNaN(parseWholeNumber(values.capacity)),
  };
  return readFormOf(draft, lotDraftErrors(draft));
}

export function useCreateLotForm(): FieldForm<LotDraftField> {
  const { navigate } = useNavigation();
  const send = async (draft: LotDraft) => {
    const created = await dashboardClient.createLot(draft);
    navigate(lotPath(created.id));
  };
  return useFieldForm({ initialValues: EMPTY_DRAFT, read: readLotDraft, send, fieldOfCode: FIELD_OF_CODE });
}
