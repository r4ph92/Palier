import type { DashboardLotMap } from '@palier/shared-types';
import { beaconBatteryErrors, type BeaconBatteryField, type BeaconBatteryReading } from '@palier/shared-types/beaconBattery';
import { dashboardClient } from '../api/dashboardClient.ts';
import type { DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { readFormOf, useFieldForm, type FieldForm, type FieldValues, type ReadForm } from '../forms/useFieldForm.ts';
import { useLanguage, type Language } from '../i18n/LanguageContext.tsx';
import { numberOrNaN, parseWholeNumber } from '../lotSetup/parseNumbers.ts';

const EMPTY_READING: FieldValues<BeaconBatteryField> = { percent: '' };
// A technician copies what the beacon's app shows, often with its percent sign: "15 %" reads as 15.
const PERCENT_SIGN = /\s*%$/;

const FIELD_OF_CODE: Partial<Readonly<Record<DisplayedErrorCode, BeaconBatteryField>>> = {
  BATTERY_PERCENT_INVALID: 'percent',
};

function readReading(values: FieldValues<BeaconBatteryField>, language: Language): ReadForm<BeaconBatteryField, BeaconBatteryReading> {
  const reading = { percent: numberOrNaN(parseWholeNumber(values.percent.trim().replace(PERCENT_SIGN, ''), language)) };
  return readFormOf(reading, beaconBatteryErrors(reading));
}

export interface RecordBatteryTarget {
  readonly lotId: string;
  readonly aisleId: string;
  readonly onRecorded: (map: DashboardLotMap, percent: number) => void;
}

export function useRecordBatteryForm({ lotId, aisleId, onRecorded }: RecordBatteryTarget): FieldForm<BeaconBatteryField> {
  const { language } = useLanguage();
  const send = async (reading: BeaconBatteryReading) => onRecorded(await dashboardClient.recordBeaconBattery(lotId, aisleId, reading), reading.percent);
  return useFieldForm({ initialValues: EMPTY_READING, read: (values) => readReading(values, language), send, fieldOfCode: FIELD_OF_CODE, emptiesOnSuccess: true });
}
