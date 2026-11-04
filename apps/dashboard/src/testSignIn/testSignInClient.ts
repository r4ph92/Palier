import type { DashboardSignInResponse, DashboardTestUserListResponse } from '@palier/shared-types';
import { dashboardRequest } from '../api/dashboardClient.ts';

// Kept apart from dashboardClient so a production build, which never imports this folder, holds no test route.
export const testSignInClient = {
  users: () => dashboardRequest<DashboardTestUserListResponse>('/test/users'),
  signIn: (userId: string) => dashboardRequest<DashboardSignInResponse>('/test/sign-in', { method: 'POST', body: { userId } }),
};
