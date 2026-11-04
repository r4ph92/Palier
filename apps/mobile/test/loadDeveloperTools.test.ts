const globals = globalThis as unknown as { __DEV__: boolean };

function loadWith(isDevelopment: boolean) {
  const original = globals.__DEV__;
  globals.__DEV__ = isDevelopment;
  try {
    let loaded: unknown;
    jest.isolateModules(() => {
      loaded = jest.requireActual<{ developerTools: unknown }>('../src/dev/loadDeveloperTools').developerTools;
    });
    return loaded;
  } finally {
    globals.__DEV__ = original;
  }
}

describe('loadDeveloperTools', () => {
  it('loads no developer tools when the build is not a development build', () => {
    expect(loadWith(false)).toBeNull();
  });

  it('loads the simulated module in a development build', () => {
    expect(loadWith(true)).toMatchObject({ module: expect.any(Object), bind: expect.any(Function) });
  });
});
