import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server', '@/server/*'],
              message: 'src/shared may not import from src/server',
            },
            {
              group: ['@/client', '@/client/*'],
              message: 'src/shared may not import from src/client',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/client/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server', '@/server/*'],
              message: 'src/client may not import from src/server',
            },
          ],
        },
      ],
    },
  },
])

export default eslintConfig
