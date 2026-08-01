/**
 * Playwright configuration — browser verification.
 *
 * Phase 0C's storage suite runs under `fake-indexeddb`, which
 * implements the API faithfully but is not a browser. It cannot prove
 * persistence across a real page reload, real IndexedDB transaction
 * lifetime, or behaviour specific to a browser engine. This config
 * exists to close that gap, and the specs under `e2e/browser`
 * exercise the same public composition the application uses.
 *
 * The server is `vite.e2e.config.ts`, whose root is the harness
 * directory. The production build never sees it.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // IndexedDB is origin-global. Even with a distinct database per
  // test, running them concurrently against one origin makes any
  // failure order-dependent and therefore useless as evidence.
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Invoked through node directly rather than `npx`. This project
    // has been built on both Node 22 and Node 24, and on Node 24 the
    // bundled npm 11 crashes on start-up with a class-extends error
    // in its own minizlib — a Node/npm incompatibility, not a project
    // one. Bypassing npm sidesteps it.
    command: 'node ./node_modules/vite/bin/vite.js --config vite.e2e.config.ts',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
