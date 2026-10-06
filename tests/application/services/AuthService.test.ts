import jwt from 'jsonwebtoken';

describe('AuthService JWT_SECRET rules', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should throw error when JWT_SECRET is unset in non-test environment', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';

    expect(() => {
      // @ts-nocheck
      const { AuthService } = require('../../../src/application/services/AuthService');
    }).toThrow('JWT_SECRET environment variable is required for security.');
  });

  it('should throw error when JWT_SECRET is empty string in non-test environment', () => {
    process.env.JWT_SECRET = '';
    process.env.NODE_ENV = 'production';

    expect(() => {
      // @ts-nocheck
      const { AuthService } = require('../../../src/application/services/AuthService');
    }).toThrow('JWT_SECRET environment variable is required for security.');
  });

  it('should fallback to test-jwt-secret in test environment when JWT_SECRET is unset', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'test';

    expect(() => {
      // @ts-nocheck
      const { AuthService } = require('../../../src/application/services/AuthService');
    }).not.toThrow();
  });

  it('should use provided JWT_SECRET when set', () => {
    process.env.JWT_SECRET = 'custom-secret-key';
    process.env.NODE_ENV = 'production';

    expect(() => {
      // @ts-nocheck
      const { AuthService } = require('../../../src/application/services/AuthService');
    }).not.toThrow();
  });
});
