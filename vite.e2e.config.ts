/**
 * Vite config for the end-to-end suite.
 *
 * Serves two things from **one origin**, on purpose:
 *
 *   /                          the application itself
 *   /e2e/harness/index.html    the persistence verification harness
 *
 * One origin because IndexedDB is scoped to one. Running the harness
 * on a second port would put its database somewhere the application
 * could never read, so no test could seed a source and then open it
 * through the real UI.
 *
 * Separate from `vite.config.ts` because the harness must never be
 * reachable in production. `npm run build` uses the default config,
 * which has no `e2e/` in its graph — `bundle`-shape assertions in
 * `navigation.test.ts` and a grep of `dist/` both check that.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  '@domain': fileURLToPath(new URL('./src/domain', import.meta.url)),
  '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
  '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
  '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
  '@design': fileURLToPath(new URL('./src/design', import.meta.url)),
  '@hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
  '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
  '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
  '@application': fileURLToPath(new URL('./src/application', import.meta.url)),
  '@tests': fileURLToPath(new URL('./src/tests', import.meta.url)),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  server: {
    port: 5174,
    strictPort: true,
  },
});
