import { TransferId } from '../../../../src/domain/intercompany/valueObjects/TransferId';

describe('TransferId Value Object', () => {
  it('should generate a valid random TransferId when created with no argument', () => {
    const id1 = TransferId.create();
    const id2 = TransferId.create();

    expect(id1.getValue()).toBeDefined();
    expect(typeof id1.getValue()).toBe('string');
    expect(id1.getValue().length).toBeGreaterThan(0);
    expect(id1.equals(id2)).toBe(false);
  });

  it('should create a TransferId with specified string value', () => {
    const customStr = 'TR-12345';
    const id = TransferId.create(customStr);

    expect(id.getValue()).toBe(customStr);
  });

  it('should trim string when creating TransferId', () => {
    const customStr = '  TR-TRIMMED  ';
    const id = TransferId.create(customStr);

    expect(id.getValue()).toBe('TR-TRIMMED');
  });

  it('should generate a random id if empty or whitespace string is passed', () => {
    const id = TransferId.create('   ');
    expect(id.getValue()).toBeDefined();
    expect(id.getValue().length).toBeGreaterThan(0);
    expect(id.getValue()).not.toBe('   ');
  });

  it('should return the same instance if a TransferId is passed to create', () => {
    const original = TransferId.create('TR-ORIG');
    const recreated = TransferId.create(original);

    expect(recreated).toBe(original);
    expect(recreated.equals(original)).toBe(true);
  });

  it('should correctly compare two TransferId instances for equality', () => {
    const id1 = TransferId.create('TR-999');
    const id2 = TransferId.create('TR-999');
    const id3 = TransferId.create('TR-888');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
    expect(id1.equals(undefined)).toBe(false);
  });
});
