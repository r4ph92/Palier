import type { TestSignInModule } from '../src/testSignIn/TestSignIn';

const globals = globalThis as unknown as { __DEV__: boolean };

function loadWith(isDevelopment: boolean) {
  const original = globals.__DEV__;
  globals.__DEV__ = isDevelopment;
  try {
    let loaded: typeof import('../src/testSignIn/loadTestSignIn') | undefined;
    jest.isolateModules(() => {
      loaded = jest.requireActual<typeof import('../src/testSignIn/loadTestSignIn')>('../src/testSignIn/loadTestSignIn');
    });
    return loaded as typeof import('../src/testSignIn/loadTestSignIn');
  } finally {
    globals.__DEV__ = original;
  }
}

describe('loadedTestSignIn', () => {
  it('loads no test sign-in when the bundle is not a development bundle', () => {
    expect(loadWith(false).loadedTestSignIn).toBeNull();
  });

  it('loads the test sign-in module in a development bundle', () => {
    expect(loadWith(true).loadedTestSignIn).toMatchObject({ createTestSignIn: expect.any(Function) });
  });
});

describe('offeredTestSignIn', () => {
  const module: TestSignInModule = { createTestSignIn: jest.fn(() => ({ Section: () => null, client: {} as never })) };

  it('is off in a release bundle even with the flag set to true', () => {
    const release = loadWith(false);

    expect(release.offeredTestSignIn(release.loadedTestSignIn, 'true', 'http://api')).toBeNull();
  });

  it.each([undefined, '', 'false', 'TRUE', '1'])('is off in a development bundle when the flag is %p', (flag) => {
    expect(loadWith(true).offeredTestSignIn(module, flag, 'http://api')).toBeNull();
  });

  it('is on in a development bundle when the flag is true', () => {
    expect(loadWith(true).offeredTestSignIn(module, 'true', 'http://api')).not.toBeNull();
    expect(module.createTestSignIn).toHaveBeenCalledWith('http://api');
  });
});
