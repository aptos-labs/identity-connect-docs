// Copyright (c) Aptos
// SPDX-License-Identifier: Apache-2.0

module.exports = {
  env: {
    es2021: true,
    jest: true,
  },
  extends: ['airbnb', 'airbnb-typescript', 'plugin:typescript-sort-keys/recommended'],
  ignorePatterns: ['dist/**/*', '*.css', '*.jsx'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    project: ['tsconfig.json', 'tsconfig.build.json'],
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: [
    '@identity-connect',
    '@typescript-eslint',
    'react',
    'react-hooks',
    'sort-class-members',
    'sort-destructure-keys',
    'sort-keys-fix',
    'header',
  ],
  rules: {
    '@typescript-eslint/brace-style': 'off',
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'variableLike',
        modifiers: ['unused'],
        format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow',
      },
    ],
    '@typescript-eslint/no-use-before-define': 'off',
    // allow unused variables that start with an underscore
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
    'function-paren-newline': 'off',
    'header/header': [2, 'line', [' Copyright © Aptos', ' SPDX-License-Identifier: Apache-2.0'], 2],
    'implicit-arrow-linebreak': 'off',
    'import/prefer-default-export': 'off',
    'max-classes-per-file': 'off',
    'max-len': ['error', { code: 120 }],
    'no-confusing-arrow': 'off',
    'no-continue': 'off',
    // Replacing airbnb rule with following, to re-enable 'ForOfStatement'
    'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
    'no-underscore-dangle': 'off',
    // Allow prepending statements with void to explicitly ignore the return value
    'no-void': ['error', { allowAsStatement: true }],
    'object-curly-newline': 'off',
    'operator-linebreak': 'off',
    'react/require-default-props': 0,
    'react-hooks/exhaustive-deps': 'warn',
    'react-hooks/rules-of-hooks': 'error',
    'react/jsx-closing-tag-location': 'off',
    'react/jsx-curly-newline': 'off',
    'react/jsx-indent': 'off',
    'react/jsx-one-expression-per-line': 'off',
    'react/jsx-props-no-spreading': 'off',
    'react/jsx-wrap-multilines': 'off',
    'sort-destructure-keys/sort-destructure-keys': 2,
    'sort-keys-fix/sort-keys-fix': 'warn',
    'sort-keys': ['error', 'asc', { caseSensitive: true, minKeys: 2, natural: false }],
    'newline-per-chained-call': ['off'],
  },
};
