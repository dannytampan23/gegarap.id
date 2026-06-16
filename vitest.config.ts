import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Keep the proven ESM-safe alias (path.resolve(__dirname) is undefined in an
    // ESM vitest.config.ts) instead of the bare __dirname form from the prompt.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // The Prisma mock MUST be a setup file: registering `vi.mock('@/lib/prisma')`
    // inside an imported helper happens AFTER the route already imported the real
    // client. As a setup file it runs before any test module loads, so routes
    // pick up the mock. Tests still `import { mockPrisma }` from the same module.
    setupFiles: ['./src/__tests__/mocks/prisma.ts', './src/__tests__/setup.ts'],
    // Only pick up unit tests under src/. This deliberately ignores the
    // Playwright `*.spec.ts` files in e2e/ (Vitest's default glob would grab
    // them and crash).
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**', 'src/app/api/**', 'src/components/**'],
      exclude: ['src/__tests__/**', 'src/app/**/page.tsx', 'src/app/**/layout.tsx'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
      },
    },
  },
});
