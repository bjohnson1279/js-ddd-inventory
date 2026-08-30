import { ABCClassificationService } from '../../../src/domain/cycleCount/ABCClassificationService';

describe('ABCClassificationService', () => {
  let service: ABCClassificationService;

  beforeEach(() => {
    service = new ABCClassificationService();
  });

  it('classifies A items correctly', () => {
    expect(service.classifySku('SKU1', 15000)).toBe('A');
  });

  it('classifies B items correctly', () => {
    expect(service.classifySku('SKU2', 5000)).toBe('B');
  });

  it('classifies C items correctly', () => {
    expect(service.classifySku('SKU3', 500)).toBe('C');
  });

  it('recommends correct frequencies', () => {
    expect(service.getRecommendedFrequency('A')).toBe(30);
    expect(service.getRecommendedFrequency('B')).toBe(90);
    expect(service.getRecommendedFrequency('C')).toBe(180);
  });
});
