import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // The rules of hooks are not style preferences: a conditional hook
  // or a stale closure in a dependency array produces a bug that
  // reproduces intermittently and is very hard to find by reading.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      // `_`-prefixed bindings are deliberate omissions, and
      // `ignoreRestSiblings` covers the standard idiom for dropping
      // a key: `const { deletedAt: _removed, ...rest } = record`.
      // Without it, the only way to remove a field immutably gets
      // flagged, which trains people to ignore the rule.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // `any` is prohibited by the implementation handoff §26, not
      // merely discouraged.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    // Node-side files: the Playwright runner, the harness Vite config
    // and the spec files all execute outside the browser.
    files: [
      'playwright.config.ts',
      'vite.e2e.config.ts',
      'e2e/browser/**/*.ts',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      'src/legacy-v1/',
    ],
  },
);
