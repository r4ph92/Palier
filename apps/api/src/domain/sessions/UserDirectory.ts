import type { SessionUser } from './SessionTokenRepository.ts';

// Sessions belong to people, whether they drive or run an operator, so sign-in looks users up here rather than in a role's repository.
export interface UserDirectory {
  findUser(userId: string): Promise<SessionUser | null>;
  // Answers in the order of the ids asked for, leaving out ids that match no user.
  findUsers(userIds: readonly string[]): Promise<readonly SessionUser[]>;
}
