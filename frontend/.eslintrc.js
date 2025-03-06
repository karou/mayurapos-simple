module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      ecmaFeatures: {
        jsx: true,
      },
      project: './tsconfig.json',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    extends: [
      'eslint:recommended',
      'plugin:react/recommended',
      'plugin:react-hooks/recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:@typescript-eslint/recommended-requiring-type-checking',
      'prettier',
    ],
    plugins: [
      'react',
      'react-hooks',
      '@typescript-eslint',
    ],
    rules: {
      // React rules
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+
      'react/prop-types': 'off', // We use TypeScript instead
      'react/display-name': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // TypeScript rules
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      
      // General rules
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always', { 'null': 'ignore' }],
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'no-param-reassign': 'error',
      'no-nested-ternary': 'warn',
      'spaced-comment': ['warn', 'always'],
    },
    overrides: [
      {
        // Test files
        files: ['**/*.test.ts', '**/*.test.tsx', '**/setupTests.ts'],
        env: {
          jest: true,
        },
        rules: {
          '@typescript-eslint/no-explicit-any': 'off',
          '@typescript-eslint/no-non-null-assertion': 'off',
        }
      },
      {
        // Configuration files
        files: ['.eslintrc.js', 'jest.config.js', 'tailwind.config.js'],
        env: {
          node: true,
        },
        rules: {
          '@typescript-eslint/no-var-requires': 'off',
        }
      }
    ],
    env: {
      browser: true,
      es2020: true,
      node: true,
    },
  };