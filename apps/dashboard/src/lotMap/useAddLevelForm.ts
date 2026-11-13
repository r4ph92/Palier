import type { DashboardLotMap } from '@palier/shared-types';
import { levelDraftErrors, type LevelDraft, type LevelDraftField } from '@palier/shared-types/levelDraft';
import { canonicalCodeOf } from '@palier/shared-types/displayText';
import { dashboardClient } from '../api/dashboardClient.ts';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { readFormOf, type FieldForm, type FieldValues, type ReadForm } from '../forms/useFieldForm.ts';
import { useResettingFieldForm } from '../forms/useResettingFieldForm.ts';

const EMPTY_LEVEL: FieldValues<LevelDraftField> = { code: '' };

const FIELD_OF_CODE: Partial<Readonly<Record<DisplayedErrorCode, LevelDraftField>>> = {
  LEVEL_CODE_INVALID: 'code',
  LEVEL_CODE_TAKEN: 'code',
};

function readLevel(values: FieldValues<LevelDraftField>): ReadForm<LevelDraftField, LevelDraft> {
  const draft = { code: canonicalCodeOf(values.code) };
  return readFormOf(draft, levelDraftErrors(draft));
}

export interface AddLevelTarget {
  readonly lotId: string;
  readonly onAdded: (map: DashboardLotMap, code: string) => void;
}

export function useAddLevelForm({ lotId, onAdded }: AddLevelTarget): FieldForm<LevelDraftField> {
  const send = async (draft: LevelDraft) => onAdded(await dashboardClient.addLevel(lotId, draft), draft.code);
  return useResettingFieldForm({ initialValues: EMPTY_LEVEL, read: readLevel, send, fieldOfCode: FIELD_OF_CODE });
}
