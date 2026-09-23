// Lint rules for the dashboard.
//
// Same principle as the API's config: every rule here answers a defect that was
// actually present in this code, not a style preference. Formatting belongs to
// Prettier and is not duplicated here.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    // Locale files are generated translation tables, and the config file
    // below is not part of any TypeScript project.
    ignores: ['dist/**', 'node_modules/**', 'src/public/**', 'src/locales/**', 'eslint.config.mjs']
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

      // The single most valuable rule for this codebase. `Conversations.tsx`
      // has ten effects that close over `selectedConversation`, `sites` and
      // `selectedSite` without listing them, which is why its socket handlers
      // sometimes acted on a stale conversation.
      'react-hooks/exhaustive-deps': 'warn',

      // The React Compiler rules that ship with this plugin are correct, and
      // every one of the 45 places they fire here is worth revisiting. They are
      // warnings rather than errors on purpose: turning them on as errors today
      // would make `npm run lint` fail on code that works, which trains people
      // to pass `--no-verify` instead of reading the output. Promote them to
      // 'error' once the current list is worked through.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',

      // 325 `any`s across both workspaces, concentrated in event handlers and
      // formatters that could all have been typed.
      '@typescript-eslint/no-explicit-any': 'warn',

      // 34 of these swallowed a failed request and left the UI showing a
      // spinner or stale data with no indication anything had gone wrong.
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

      // The new JSX transform is configured (`jsx: react-jsx`), so React does
      // not need to be in scope and prop types are TypeScript's job.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // A list rendered without a stable key re-mounts rows on every update,
      // which loses input focus in the inbox.
      'react/jsx-key': 'error',

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error'
    }
  }
);
