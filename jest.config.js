const path = require('path');

module.exports = {
  rootDir: __dirname,
  roots: ['<rootDir>/packages/expo-sse/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': [
      'babel-jest',
      { configFile: path.resolve(__dirname, 'babel.config.js') },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@testing-library)/)',
  ],
  moduleNameMapper: {
    '^expo/fetch$': '<rootDir>/packages/expo-sse/src/__mocks__/expo-fetch.ts',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFiles: [path.resolve(__dirname, 'jest.setup.js')],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'packages/expo-sse/src/**/*.{ts,tsx}',
    '!packages/expo-sse/src/**/__tests__/**',
    '!packages/expo-sse/src/**/index.ts',
  ],
};
