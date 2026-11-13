import { LOT_ADDRESS_LENGTH, LOT_CAPACITY_LIMITS, LOT_NAME_LENGTH, type LotDraftErrorCode } from '@palier/shared-types/lotDraft';
import {
  DAILY_CAP_CENTS_LIMITS,
  HOLD_QUOTA_LIMITS,
  INCREMENT_CENTS_LIMITS,
  INCREMENT_MINUTES_LIMITS,
  type PricingErrorCode,
} from '@palier/shared-types/lotPricing';

export const LOT_SETUP_MESSAGES: Readonly<Record<LotDraftErrorCode | PricingErrorCode, string>> = {
  LOT_NAME_REQUIRED: 'The lot name is required.',
  LOT_NAME_INVALID: `The lot name must be ${LOT_NAME_LENGTH.minimum} to ${LOT_NAME_LENGTH.maximum} characters, with no invisible characters.`,
  LOT_ADDRESS_REQUIRED: 'The address is required.',
  LOT_ADDRESS_INVALID: `The address must be ${LOT_ADDRESS_LENGTH.minimum} to ${LOT_ADDRESS_LENGTH.maximum} characters, with no invisible characters.`,
  LOT_LATITUDE_INVALID: 'The latitude must be within -90 to 90 degrees.',
  LOT_LONGITUDE_INVALID: 'The longitude must be within -180 to 180 degrees.',
  LOT_CAPACITY_INVALID: `The capacity must be a whole number from ${LOT_CAPACITY_LIMITS.minimum} to ${LOT_CAPACITY_LIMITS.maximum}.`,
  PRICING_INCREMENT_CENTS_INVALID: `The increment price must be a whole number of cents from ${INCREMENT_CENTS_LIMITS.minimum} to ${INCREMENT_CENTS_LIMITS.maximum}.`,
  PRICING_INCREMENT_MINUTES_INVALID: `The increment must be a whole number of minutes from ${INCREMENT_MINUTES_LIMITS.minimum} to ${INCREMENT_MINUTES_LIMITS.maximum}.`,
  PRICING_DAILY_CAP_REQUIRED: 'The daily cap is required.',
  PRICING_DAILY_CAP_INVALID: `The daily cap must be a whole number of cents from ${DAILY_CAP_CENTS_LIMITS.minimum} to ${DAILY_CAP_CENTS_LIMITS.maximum}.`,
  PRICING_DAILY_CAP_BELOW_INCREMENT: 'The daily cap must be at least the price of one increment.',
  PRICING_HOLD_QUOTA_INVALID: `The hold quota must be a whole number from ${HOLD_QUOTA_LIMITS.minimum} to ${HOLD_QUOTA_LIMITS.maximum}.`,
};
