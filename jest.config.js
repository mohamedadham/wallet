/**
 * Two Jest projects:
 *  - "unit": fast, no external services. Includes the contract suite run against the in-memory adapter.
 *  - "e2e":  boots the Nest app and (for the Postgres contract + concurrency tests) talks to a real DB.
 *            Requires DATABASE_URL to point at a reachable Postgres; skips DB-only specs otherwise.
 */
const base = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
};

module.exports = {
  projects: [
    {
      ...base,
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/contract/**/*.spec.ts'],
    },
    {
      ...base,
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
    },
  ],
};
