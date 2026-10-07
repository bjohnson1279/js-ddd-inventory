import { ApiUsageMetricRepository } from '../../../src/infrastructure/database/ApiUsageMetricRepository';

describe('ApiUsageMetricRepository', () => {
  let repository: ApiUsageMetricRepository;

  beforeEach(() => {
    repository = new ApiUsageMetricRepository();
  });

  it('should return early when NODE_ENV is test for incrementUsage', async () => {
    // NODE_ENV is set to "test" by default in Jest
    await expect(repository.incrementUsage('tenant-1', '/api/v1/products')).resolves.not.toThrow();
  });

  it('should call findMany when getUsageByTenant is invoked', async () => {
    const mockFindMany = jest.fn().mockResolvedValue([
      { tenantId: 'tenant-1', metric: '/api/v1/products', value: 5, date: new Date() }
    ]);

    (repository as any).prismaClient = {
      apiUsageMetricModel: {
        findMany: mockFindMany
      }
    };

    const result = await repository.getUsageByTenant('tenant-1');

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { date: 'desc' }
    });
    expect(result).toHaveLength(1);
  });
});
