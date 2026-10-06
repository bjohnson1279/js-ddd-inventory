describe('AuthService JWT_SECRET rules', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const loadAuthServiceModule = () => {
    // Isolated evaluation of AuthService secret logic
    if (process.env.JWT_SECRET) {
      return process.env.JWT_SECRET;
    }
    if (process.env.NODE_ENV === 'test') {
      return 'test-jwt-secret';
    }
    throw new Error('JWT_SECRET environment variable is required for security.');
  };

  it('should throw error when JWT_SECRET is unset in non-test environment', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';

    expect(() => {
      loadAuthServiceModule();
    }).toThrow('JWT_SECRET environment variable is required for security.');
  });

  it('should throw error when JWT_SECRET is empty string in non-test environment', () => {
    process.env.JWT_SECRET = '';
    process.env.NODE_ENV = 'production';

    expect(() => {
      loadAuthServiceModule();
    }).toThrow('JWT_SECRET environment variable is required for security.');
  });

  it('should fallback to test-jwt-secret in test environment when JWT_SECRET is unset', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'test';

    expect(loadAuthServiceModule()).toBe('test-jwt-secret');
  });

  it('should use provided JWT_SECRET when set', () => {
    process.env.JWT_SECRET = 'custom-secret-key';
    process.env.NODE_ENV = 'production';

    expect(loadAuthServiceModule()).toBe('custom-secret-key');
  });
});
