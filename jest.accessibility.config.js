module.exports = {
  displayName: 'Accessibility Tests',
  testMatch: ['<rootDir>/src/accessibility/**/*.accessibility.test.{js,ts,tsx}'],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/e2e/**/*',
    '!src/performance/**/*',
    '!src/accessibility/**/*',
    '!src/test-utils/**/*'
  ]
};