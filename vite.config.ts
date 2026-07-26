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
  // Vitest reads test config from here (Vite 8 + Vitest 3 share
  // one defineConfig to avoid plugin type conflicts between
  // Rolldown and Rollup).
  // @ts-expect-error — Vitest extends Vite's UserConfig at runtime
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    alias,
  },
});
