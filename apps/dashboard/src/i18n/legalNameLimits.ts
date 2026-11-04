import { LEGAL_NAME_LENGTH } from '@palier/shared-types/dashboard';

// Fills %{minimum} and %{maximum} in the legal-name copy, so the sentences follow the API's rule.
export const LEGAL_NAME_LIMITS: Readonly<Record<string, string>> = {
  minimum: String(LEGAL_NAME_LENGTH.minimum),
  maximum: String(LEGAL_NAME_LENGTH.maximum),
};
