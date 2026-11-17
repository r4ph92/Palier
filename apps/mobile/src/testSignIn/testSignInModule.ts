import { HttpTestSignInClient } from './HttpTestSignInClient';
import type { TestSignInModule } from './TestSignIn';
import { TestSignInSection } from './TestSignInSection';

export const testSignInModule: TestSignInModule = {
  createTestSignIn: (baseUrl) => ({ Section: TestSignInSection, client: new HttpTestSignInClient({ baseUrl }) }),
};
