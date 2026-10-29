import { RecommendationId } from '../../../../src/domain/yield_management/valueObjects/RecommendationId';

describe('RecommendationId Value Object', () => {
  it('should generate a valid random RecommendationId when created with no argument', () => {
    const id1 = RecommendationId.create();
    const id2 = RecommendationId.create();

    expect(id1.getValue()).toBeDefined();
    expect(typeof id1.getValue()).toBe('string');
    expect(id1.getValue().length).toBeGreaterThan(0);
    expect(id1.equals(id2)).toBe(false);
  });

  it('should create a RecommendationId with specified string value', () => {
    const customStr = 'rec-12345';
    const id = RecommendationId.create(customStr);

    expect(id.getValue()).toBe(customStr);
  });

  it('should correctly compare two RecommendationId instances for equality', () => {
    const id1 = RecommendationId.create('rec-999');
    const id2 = RecommendationId.create('rec-999');
    const id3 = RecommendationId.create('rec-888');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
    expect(id1.equals(undefined)).toBe(false);
  });
});
