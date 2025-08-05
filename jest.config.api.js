const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const config = {
  displayName: 'API Tests',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.api.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/__tests__/api/**/*.test.{js,ts}',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
  ],
  collectCoverageFrom: [
    'src/app/api/**/*.{js,ts}',
    '!src/**/*.d.ts',
  ],
  verbose: true,
};

module.exports = createJestConfig(config);
