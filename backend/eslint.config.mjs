// Lint rules for the API. Formatting is Prettier's job.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    // `src/widget` is compiled for the browser by its own tsconfig.
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
      '@typescript-eslint/no-explicit-any': 'warn',

      // A deliberate no-op catch must say so in a comment.
      'no-empty': ['error', { allowEmptyCatch: false }],

      // A leading underscore marks a parameter that is intentionally unused.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],

      // `void expr` marks a deliberate fire-and-forget.
      '@typescript-eslint/no-floating-promises': 'error',

      // Usually an N+1 query; sometimes the sequential form is required.
      'no-await-in-loop': 'warn',

      'no-console': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error'
    }
  },

  {
    // `node:test` awaits the promise `test()` returns, and tests assert on
    // shapes the production types narrow away.
    files: ['tests/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-await-in-loop': 'off'
    }
  }
);
