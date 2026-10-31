import { InspectionId } from '../../../../src/domain/vision/valueObjects/InspectionId';

describe('InspectionId Value Object', () => {
  it('should generate a valid random InspectionId when created with no argument', () => {
    const id1 = InspectionId.create();
    const id2 = InspectionId.create();

    expect(id1.getValue()).toBeDefined();
    expect(typeof id1.getValue()).toBe('string');
    expect(id1.getValue().length).toBeGreaterThan(0);
    expect(id1.equals(id2)).toBe(false);
  });

  it('should create an InspectionId with specified string value', () => {
    const customStr = 'INS-12345';
    const id = InspectionId.create(customStr);

    expect(id.getValue()).toBe(customStr);
  });

  it('should return the same instance if an InspectionId is passed to create', () => {
    const original = InspectionId.create('INS-ORIG');
    const recreated = InspectionId.create(original);

    expect(recreated).toBe(original);
    expect(recreated.equals(original)).toBe(true);
  });

  it('should correctly compare two InspectionId instances for equality', () => {
    const id1 = InspectionId.create('INS-999');
    const id2 = InspectionId.create('INS-999');
    const id3 = InspectionId.create('INS-888');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
    expect(id1.equals(undefined)).toBe(false);
  });
});
