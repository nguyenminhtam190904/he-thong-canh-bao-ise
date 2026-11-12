module.exports = {
  env: { browser: true, es2022: true },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['react'],
  settings: { react: { version: 'detect' } },
  rules: {
    'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
    'react/jsx-uses-vars': 'error',
  },
};
