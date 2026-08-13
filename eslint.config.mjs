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
    files: ['src/client/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server', '@/server/*'],
              message: 'src/client and src/components may not import from src/server',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/client/shell/**/*.{ts,tsx}',
      'src/client/states/**/*.{ts,tsx}',
      'src/app/(app)/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
      'src/app/dev/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/client/api',
              importNames: ['call'],
              message:
                'Use a domain hook from @/client/hooks — do not import call() in UI surfaces',
            },
            {
              name: '@/client/api/client',
              importNames: ['call'],
              message:
                'Use a domain hook from @/client/hooks — do not import call() in UI surfaces',
            },
            {
              name: '@/client/api/index',
              importNames: ['call'],
              message:
                'Use a domain hook from @/client/hooks — do not import call() in UI surfaces',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fetch']",
          message: 'Use call() from @/client/api — do not call fetch directly',
        },
        {
          selector: "CallExpression[callee.object.name='window'][callee.property.name='fetch']",
          message: 'Use call() from @/client/api — do not call fetch directly',
        },
        {
          selector: "CallExpression[callee.object.name='globalThis'][callee.property.name='fetch']",
          message: 'Use call() from @/client/api — do not call fetch directly',
        },
      ],
    },
  },
])

export default eslintConfig
