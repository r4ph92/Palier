import type { ComponentType } from 'react';
import type { TestSignInSectionProps } from './TestSignInSection';
import type { TestSignInClient } from './TestSignInClient';

export interface TestSignIn {
  readonly Section: ComponentType<TestSignInSectionProps>;
  readonly client: TestSignInClient;
}

export interface TestSignInModule {
  createTestSignIn(baseUrl: string): TestSignIn;
}
