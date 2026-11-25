// The statements of Apple and Google sign-in, which find or create the account an identity opens.
export type IdentityStatementLabel = 'find-identity-user' | 'insert-app-user' | 'find-user-by-email' | 'insert-user-identity';

export const IDENTITY_STATEMENT_PATTERNS: readonly (readonly [IdentityStatementLabel, RegExp])[] = [
  ['find-identity-user', /select user_id from user_identity/],
  ['insert-app-user', /insert into app_user/],
  ['find-user-by-email', /select id as user_id from app_user where email/],
  ['insert-user-identity', /insert into user_identity/],
];
