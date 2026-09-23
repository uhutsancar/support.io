// Lint rules for the API.
//
// The project had no linter at all, which is why 325 `any`s, dozens of unused
// imports and several empty catch blocks survived review. The rules below are
// deliberately few: each one corresponds to a class of defect that was actually
// found in this codebase, so none of them is a matter of taste.
//
// Formatting is Prettier's job (see .prettierrc.json); nothing here duplicates
// it, so the two cannot disagree.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    // `src/widget` is compiled by its own tsconfig for the browser, and the
    // config file below is not part of any TypeScript project.
    ignores: ['dist/**', 'node_modules/**', 'public/**', 'src/widget/**', 'eslint.config.mjs']
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },

    rules: {
      // `any` is how the type system was opted out of in 325 places. Warn
      // rather than error so it does not block work, but make each one visible.
      '@typescript-eslint/no-explicit-any': 'warn',

      // An empty catch is indistinguishable from a forgotten one. 51 of these
      // existed here, most of them silently discarding real failures. A
      // deliberate no-op must say so in a comment, which this allows.
      'no-empty': ['error', { allowEmptyCatch: false }],

      // Dead imports and variables accumulated because nothing removed them.
      // A leading underscore marks one that is intentionally unused, which is
      // common for an Express `_res` a middleware does not touch.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],

      // A promise nobody awaits is how a socket handler's failure used to
      // disappear. `void expr` marks a deliberate fire-and-forget.
      '@typescript-eslint/no-floating-promises': 'error',

      // `await` inside a loop over rows is usually an N+1 query; several of the
      // slow endpoints here were exactly that. Warn, because the sequential
      // form is sometimes required (the proactive engine's per-visitor lock).
      'no-await-in-loop': 'warn',

      // The server logs deliberately; the browser bundle does not (see the
      // admin-panel config).
      'no-console': 'off',

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error'
    }
  },

  {
    // Tests and one-off scripts.
    //
    // `no-floating-promises` is off here because `node:test`'s `test()` returns
    // a promise the runner itself awaits; flagging every test case would be
    // 95 false positives and would train people to ignore the rule. `any` is
    // allowed because a test deliberately asserts on shapes the production
    // types narrow away.
    files: ['tests/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-await-in-loop': 'off'
    }
  }
);
