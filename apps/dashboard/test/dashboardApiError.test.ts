import { DASHBOARD_ERROR_CODES } from '@palier/shared-types/dashboard';
import { describe, expect, it } from 'vitest';
import { DashboardApiError } from '../src/api/DashboardApiError.ts';

describe('dashboard API errors', () => {
  it.each(DASHBOARD_ERROR_CODES)('keeps the code %s the API sends', (code) => {
    expect(new DashboardApiError(400, code).code).toBe(code);
  });

  it.each([['an unknown code', 'FST_ERR_VALIDATION'], ['no code', undefined]])('shows the generic sentence for %s', (_case, code) => {
    expect(new DashboardApiError(500, code).code).toBe('UNKNOWN');
  });
});
