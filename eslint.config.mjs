// ESLint 9 flat config (F7, qa-W1). Replaces the legacy .eslintrc.json,
// which ESLint 9 ignores.
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    'node_modules/**',
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    'files/**',
    'docs/archive/**',
    'ml-service/**',
    'public/sw.js',
    'public/workbox-*.js',
    'public/fallback-*.js',
  ]),
  {
    // Guardrail 5 (B-015): no Math random() outside tests and demo code.
    // (Phrased without the literal so scripts/check-guardrails.mjs does not flag this file.)
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Math random() is banned outside tests/ and demo/ (guardrail 5). Use crypto.randomUUID()/crypto.getRandomValues(), or real data behind NOAH_DEMO_MODE.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.*', '**/*.spec.*', 'tests/**', '**/demo/**'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
]);
