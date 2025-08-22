module.exports = {
  displayName: 'E2E Tests',
  testMatch: ['<rootDir>/src/e2e/**/*.e2e.test.{js,ts,tsx}'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/e2e/setup.ts'],
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
    '!src/test-utils/**/*'
  ]
};