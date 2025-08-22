module.exports = {
  displayName: 'Performance Tests',
  testMatch: ['<rootDir>/src/performance/**/*.performance.test.{js,ts,tsx}'],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  testTimeout: 60000, // Longer timeout for performance tests
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/e2e/**/*',
    '!src/performance/**/*',
    '!src/test-utils/**/*'
  ]
};