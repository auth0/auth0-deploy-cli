const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsEslint = require('@typescript-eslint/eslint-plugin');
const importPlugin = require('eslint-plugin-import');
const globals = require('globals');
const eslintConfigPrettier = require('eslint-config-prettier');

const baseRecommended = js.configs.recommended;

module.exports = [
  {
    ignores: [
      'coverage/**',
      'examples/**',
      'local/**',
      'node_modules/**',
      'lib/**',
      'test/e2e/testdata/**',
      'webpack/**',
    ],
  },
  {
    ...baseRecommended,
    files: ['**/*.{js,ts,cjs,mjs}'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    languageOptions: {
      ...(baseRecommended.languageOptions ?? {}),
      parser: tsParser,
      parserOptions: {
        ...(baseRecommended.languageOptions?.parserOptions ?? {}),
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        ...(baseRecommended.languageOptions?.globals ?? {}),
        ...globals.es2020,
        ...globals.node,
        ...globals.mocha,
      },
    },
    plugins: {
      ...(baseRecommended.plugins ?? {}),
      import: importPlugin,
      '@typescript-eslint': tsEslint,
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.ts', '.mjs', '.cjs'],
        },
      },
    },
    rules: {
      ...(baseRecommended.rules ?? {}),
      'max-len': 'off',
      'class-methods-use-this': 'off',
      'comma-dangle': 'off',
      'eol-last': ['error', 'always'],
      indent: [
        'error',
        2,
        {
          SwitchCase: 1,
        },
      ],
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: true,
        },
      ],
      'import/no-dynamic-require': 'off',
      'prefer-arrow-callback': 'off',
      'object-shorthand': 'off',
      'prefer-template': 'off',
      'func-names': 'off',
      'new-cap': 'off',
      'no-await-in-loop': 'off',
      'no-param-reassign': 'off',
      'no-multiple-empty-lines': [
        'error',
        {
          max: 1,
          maxEOF: 0,
        },
      ],
      'no-plusplus': 'off',
      'no-extra-boolean-cast': 'off',
      'no-useless-escape': 'off',
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
      'no-console': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-redeclare': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-var': 'off',
      'object-curly-spacing': ['error', 'always'],
      quotes: [
        'error',
        'single',
        {
          avoidEscape: true,
        },
      ],
      semi: ['error', 'always'],
      strict: 'off',
      'space-before-blocks': ['error', 'always'],
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'never',
          ts: 'never',
          mjs: 'never',
          cjs: 'never',
        },
      ],
    },
  },
  eslintConfigPrettier,
];
