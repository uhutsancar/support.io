// Lint rules for the panel and the marketing site. Formatting is Prettier's job.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    // public/ is served as it is (the service worker among it); the locale
    // files are translation tables.
    ignores: ['dist/**', 'node_modules/**', 'public/**', 'src/locales/**', 'eslint.config.mjs']
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: { jsx: true }
      }
    },

    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },

    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',

      '@typescript-eslint/no-explicit-any': 'warn',

      // A swallowed request failure leaves the UI on a spinner or stale data.
      'no-empty': ['error', { allowEmptyCatch: false }],

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],

      // Anything logged here ships to the customer's browser.
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // The JSX transform is `react-jsx`, and prop types are TypeScript's job.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-key': 'error',

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error'
    }
  }
);
