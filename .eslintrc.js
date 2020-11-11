// https://eslint.org/docs/user-guide/configuring
module.exports = {
  extends: ['airbnb-base', 'airbnb-typescript/base'],
  rules: {
    // Maximum line length (Unicode characters).
    'max-len': ['warn', {
      code: 100,
      tabWidth: 2,
      ignoreComments: true,
      ignoreTrailingComments: true,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true,
    }],
    'no-underscore-dangle': 'off',
    'no-plusplus': 'off',
    // Disallow calls to methods of the console object.
    'no-console': 'off',
    // Reduce the scrolling required when reading through code.
    'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1 }],
    // Each file may contain only a particular number of classes.
    'max-classes-per-file': ['error', 5],
    // Cyclomatic complexity threshold.
    complexity: ['error', { max: 10 }],
  },
  parserOptions: {
    project: './tsconfig.json',
  },
};
