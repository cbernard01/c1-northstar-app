const nextJest = require('next/jest')

/** @type {import('jest').Config} */
const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const config = {
  coverageProvider: 'v8',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  transformIgnorePatterns: [
    'node_modules/(?!(lucide-react|@tanstack/react-query|zustand)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/layout.tsx',
    '!src/app/globals.css',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  projects: [
    {
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
        '<rootDir>/src/**/*.(test|spec).{js,jsx,ts,tsx}',
      ],
      testPathIgnorePatterns: [
        '<rootDir>/src/**/__tests__/api/**',
        '<rootDir>/.next/',
        '<rootDir>/node_modules/',
      ],
    },
    {
      displayName: 'api',
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.api.js'],
      testMatch: [
        '<rootDir>/src/**/__tests__/api/**/*.{js,jsx,ts,tsx}',
      ],
      testPathIgnorePatterns: [
        '<rootDir>/.next/',
        '<rootDir>/node_modules/',
      ],
      testEnvironmentOptions: {
        customExportConditions: ['node', 'node-addons'],
      },
    },
  ],
}

// Multi-environment Jest configuration
module.exports = createJestConfig(config)