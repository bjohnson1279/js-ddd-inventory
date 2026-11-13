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
    global: { statements: 79, branches: 62, functions: 81, lines: 80 },
    './src/application/useCases/ReceiveStock.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
    './src/application/useCases/DispatchStock.ts': { statements: 100, branches: 95, functions: 100, lines: 100 },
  },
};
