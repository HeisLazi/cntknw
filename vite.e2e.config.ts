/**
 * Vite config for the browser verification harness.
 *
 * Separate from `vite.config.ts` on purpose. Its root is
 * `e2e/harness`, so the harness page is reachable only when this
 * config is running — `npm run build` uses the default config and
 * cannot pick it up. A dev-only surface that ships in the production
 * bundle is not dev-only.
 */
import { defineConfig } from 'vite';
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
};

export default defineConfig({
  root: fileURLToPath(new URL('./e2e/harness', import.meta.url)),
  resolve: { alias },
  server: {
    port: 5174,
    strictPort: true,
    // The harness imports from ../../src, which is outside its root.
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url))] },
  },
});
