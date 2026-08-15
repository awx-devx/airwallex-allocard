import path from 'node:path'
import { defineConfig } from 'vitest/config'

const shared = {
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'node' as const,
    env: {
      MONGOMS_DOWNLOAD_DIR: path.resolve(
        import.meta.dirname,
        './node_modules/.cache/mongodb-binaries',
      ),
    },
    setupFiles: ['./test/setup.ts'],
  },
}

export default defineConfig({
  test: {
    projects: [
      {
        ...shared,
        test: {
          ...shared.test,
          name: 'unit',
          include: [
            'src/server/env.test.ts',
            'src/server/db/**/*.test.ts',
            'src/server/http/**/*.test.ts',
            'src/server/lib/**/*.test.ts',
            'src/server/redis.test.ts',
            'src/server/airwallex/**/*.test.ts',
            'src/client/**/*.test.ts',
            'src/lib/**/*.test.ts',
            'src/components/**/*.test.ts',
            'src/shared/constants/**/*.test.ts',
            'src/shared/access/**/*.test.ts',
            'src/shared/projectLifecycle.test.ts',
          ],
        },
      },
      {
        ...shared,
        test: {
          ...shared.test,
          name: 'integration',
          include: [
            'src/server/models/**/*.test.ts',
            'src/server/repositories/**/*.test.ts',
            'src/server/auth/**/*.test.ts',
            'src/server/events/**/*.test.ts',
            'src/server/services/**/*.test.ts',
            'src/server/health*.test.ts',
            'src/app/**/*.test.ts',
            'test/**/*.test.ts',
          ],
        },
      },
    ],
  },
})
