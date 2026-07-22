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
    // Pinned so date-boundary tests (getLogicalDate, recurrence) are
    // reproducible regardless of the host machine's timezone. See the
    // getLogicalDate tests for why this matters — the function itself is
    // NOT timezone-safe (mixes local-hour comparison with UTC
    // serialization), so results legitimately differ by host timezone
    // outside of tests too.
    env: { TZ: 'UTC' },
  },
});
