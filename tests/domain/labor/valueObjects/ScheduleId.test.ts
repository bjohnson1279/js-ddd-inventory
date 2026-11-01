import { ScheduleId } from '../../../../src/domain/labor/valueObjects/ScheduleId';

describe('ScheduleId Value Object', () => {
  it('should generate a valid random ScheduleId when created with no argument', () => {
    const id1 = ScheduleId.create();
    const id2 = ScheduleId.create();

    expect(id1.getValue()).toBeDefined();
    expect(typeof id1.getValue()).toBe('string');
    expect(id1.getValue().length).toBeGreaterThan(0);
    expect(id1.equals(id2)).toBe(false);
  });

  it('should create a ScheduleId with specified string value', () => {
    const customStr = 'SCH-12345';
    const id = ScheduleId.create(customStr);

    expect(id.getValue()).toBe(customStr);
  });

  it('should return the same instance if a ScheduleId is passed to create', () => {
    const original = ScheduleId.create('SCH-ORIG');
    const recreated = ScheduleId.create(original);

    expect(recreated).toBe(original);
    expect(recreated.equals(original)).toBe(true);
  });

  it('should correctly compare two ScheduleId instances for equality', () => {
    const id1 = ScheduleId.create('SCH-999');
    const id2 = ScheduleId.create('SCH-999');
    const id3 = ScheduleId.create('SCH-888');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
    expect(id1.equals(undefined)).toBe(false);
  });
});
