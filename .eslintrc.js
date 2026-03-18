module.exports = {
  root: true,
  extends: ['@react-native', 'prettier'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    'prettier/prettier': 'error',
  },
  ignorePatterns: ['dist', 'build', 'coverage', '.turbo', 'node_modules'],
};
