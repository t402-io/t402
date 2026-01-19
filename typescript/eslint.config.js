import js from '@eslint/js'
import ts from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

export default [
  // Base JS recommended rules first
  js.configs.recommended,
  // Ignores
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/bin/**'],
  },
  // TypeScript files config (overrides base rules)
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        // Browser globals
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        RequestInit: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        // React
        React: 'readonly',
        JSX: 'readonly',
        // Test globals
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        jest: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      ...ts.configs.recommended.rules,
      // Disable base no-unused-vars in favor of TypeScript version
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  // Test files config (more relaxed)
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/test/**/*.ts', '**/test/**/*.tsx'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
