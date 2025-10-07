import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: {
          configPath: './wrangler.toml',
        },
        miniflare: {
          bindings: {
            TEST_MODE: 'true'
          }
        }
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['functions/api/**/*.ts'],
      exclude: ['functions/api/**/*.test.ts', 'tests/**']
    }
  }
});
