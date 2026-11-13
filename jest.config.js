module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^uuid$': '<rootDir>/tests/__mocks__/uuid.js',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/__tests__/**',
  ],
  coverageReporters: ['text', 'json-summary', 'lcov', 'cobertura'],
  coverageThreshold: {
    global: { statements: 45, branches: 35, functions: 45, lines: 45 },
    './src/application/useCases/ReceiveStock.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
    './src/application/useCases/DispatchStock.ts': { statements: 100, branches: 95, functions: 100, lines: 100 },
  },
};
