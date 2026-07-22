import { defineConfig } from 'vitest/config';
import path from 'path';

// Separate from vite.config.ts on purpose: production build config (plugins,
// dev server proxy, worker format) has no bearing on running pure-logic
// tests, and keeping this standalone avoids vitest-only concerns leaking
// into the app bundle config. The `@shared/*` alias is duplicated from
// vite.config.ts / tsconfig.json — keep the three in sync if it changes.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // No TZ pin: getLogicalDate (client/src/utils/time.ts) works entirely
    // in local date components and recurrence (client/src/utils/recurrence.ts)
    // works entirely in UTC — neither mixes the two anymore, so both are
    // deterministic regardless of the host machine's timezone. If a future
    // date-boundary test genuinely needs a specific timezone, simulate it
    // per-test with `vi.stubEnv('TZ', ...)` rather than re-pinning globally.
  },
});
