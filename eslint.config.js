import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/node_modules', '**/.next', '**/dist', '**/release', 'apps/desktop/web-dist', '**/next-env.d.ts', 'scripts/**/*.cjs', 'apps/web/public/sw.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
  {
    // Domain rules stay runtime-agnostic (Node, Bun or the browser): no Node built-ins, no framework imports.
    files: ['packages/domain/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['node:*', 'react', 'next', 'next/*', 'hono', 'zod'] }],
    },
  },
  {
    files: ['apps/desktop/**/*.{cjs,mjs}'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
)
