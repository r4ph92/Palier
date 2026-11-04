import { defineConfig, loadEnv } from 'vite';

const DEFAULT_API_PORT = '3000';

// In development the browser talks to Vite only; /v1 is forwarded to the API, so the cookie stays same-origin and no CORS is needed.
export default defineConfig(({ mode }) => {
  const environment = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const apiPort = environment['API_PORT'] ?? DEFAULT_API_PORT;
  return {
    server: { proxy: { '/v1': `http://127.0.0.1:${apiPort}` } },
    test: {
      environment: 'jsdom',
      include: ['test/**/*.test.{ts,tsx}'],
      setupFiles: ['test/setup.ts'],
    },
  };
});
