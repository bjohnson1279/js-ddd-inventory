import { AutoRetryDecorator } from '../../../src/application/decorators/AutoRetryDecorator';
import { ConcurrencyException } from '../../../src/domain/exceptions/ConcurrencyException';

describe('AutoRetryDecorator (Express)', () => {
  it('should successfully execute if it never throws an error', async () => {
    const mockUseCase = {
      execute: jest.fn().mockResolvedValue('success-val')
    };

    const decorated = AutoRetryDecorator.wrap(mockUseCase, 3, 1);
    const result = await decorated.execute('input-arg');

    expect(result).toBe('success-val');
    expect(mockUseCase.execute).toHaveBeenCalledTimes(1);
    expect(mockUseCase.execute).toHaveBeenCalledWith('input-arg');
  });

  it('should retry on ConcurrencyException and succeed if resolved within limit', async () => {
    let callCount = 0;
    const mockUseCase = {
      execute: jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new ConcurrencyException('SKU-1', 'LOC-1');
        }
        return 'success-on-third';
      })
    };

    const decorated = AutoRetryDecorator.wrap(mockUseCase, 3, 5);
    const result = await decorated.execute();

    expect(result).toBe('success-on-third');
    expect(mockUseCase.execute).toHaveBeenCalledTimes(3);
  });

  it('should propagate ConcurrencyException if retries exceed the maximum limit', async () => {
    const mockUseCase = {
      execute: jest.fn().mockImplementation(async () => {
        throw new ConcurrencyException('SKU-1', 'LOC-1');
      })
    };

    const decorated = AutoRetryDecorator.wrap(mockUseCase, 2, 5);

    await expect(decorated.execute()).rejects.toThrow(ConcurrencyException);
    expect(mockUseCase.execute).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should not retry and immediately propagate non-concurrency errors', async () => {
    const mockUseCase = {
      execute: jest.fn().mockImplementation(async () => {
        throw new Error('Some other error');
      })
    };

    const decorated = AutoRetryDecorator.wrap(mockUseCase, 3, 5);

    await expect(decorated.execute()).rejects.toThrow('Some other error');
    expect(mockUseCase.execute).toHaveBeenCalledTimes(1);
  });
});
