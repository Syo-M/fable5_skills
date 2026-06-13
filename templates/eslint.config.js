// Starter ESLint flat config — copy to eslint.config.js. Encodes the rule→tool mapping
// from the `tooling` skill. Install the referenced plugins, pin versions, and adapt the
// `files`/`ignores` and framework presets (next / astro) to the project.
// This is a STARTING POINT, not a drop-in: verify each rule against your stack.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true } },
    plugins: { import: importPlugin, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      // CLAUDE.md non-negotiables
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true }],

      // react-patterns
      ...reactHooks.configs.recommended.rules, // rules-of-hooks, exhaustive-deps
      'react/no-array-index-key': 'error',

      // Named exports only — exceptions per react-patterns (routes, configs, CSF meta)
      'import/no-default-export': 'error',

      // frontend-security: no eval family
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',

      // a11y (recommended set as errors)
      ...jsxA11y.configs.recommended.rules,
    },
  },
  // Default-export exceptions (react-patterns / tooling)
  {
    files: [
      '**/app/**', '**/pages/**', 'src/pages/**',
      '**/*.stories.*', '**/*.config.*', '.storybook/**',
    ],
    rules: { 'import/no-default-export': 'off' },
  },
  // Tests: relax type-aware strictness where it fights test ergonomics (keep no-explicit-any on)
  {
    files: ['**/*.test.*', '**/*.spec.*'],
    rules: { '@typescript-eslint/no-unsafe-assignment': 'off' },
  },
);

// Also wire (not shown): eslint-plugin-testing-library, eslint-plugin-playwright,
// eslint-plugin-storybook, and import/no-restricted-paths for server-only isolation
// and feature boundaries — see the `tooling` skill table.
