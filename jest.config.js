// jest.config.js: Jest configuration for TypeScript tests
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  // Increase timeout to handle complex cron calculations
  testTimeout: 10000,
};
