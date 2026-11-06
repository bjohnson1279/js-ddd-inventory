import { NotificationId } from '../../../../src/domain/notification/valueObjects/NotificationId';

describe('NotificationId Value Object', () => {
  it('should generate a valid random NotificationId when created with no argument', () => {
    const id1 = NotificationId.create();
    const id2 = NotificationId.create();

    expect(id1.getValue()).toBeDefined();
    expect(typeof id1.getValue()).toBe('string');
    expect(id1.getValue().length).toBeGreaterThan(0);
    expect(id1.equals(id2)).toBe(false);
  });

  it('should create a NotificationId with specified string value', () => {
    const customStr = 'NOTIF-12345';
    const id = NotificationId.create(customStr);

    expect(id.getValue()).toBe(customStr);
  });

  it('should trim string when creating NotificationId', () => {
    const customStr = '  NOTIF-TRIMMED  ';
    const id = NotificationId.create(customStr);

    expect(id.getValue()).toBe('NOTIF-TRIMMED');
  });

  it('should generate a random id if empty or whitespace string is passed', () => {
    const id = NotificationId.create('   ');
    expect(id.getValue()).toBeDefined();
    expect(id.getValue().length).toBeGreaterThan(0);
    expect(id.getValue()).not.toBe('   ');
  });

  it('should return the same instance if a NotificationId is passed to create', () => {
    const original = NotificationId.create('NOTIF-ORIG');
    const recreated = NotificationId.create(original);

    expect(recreated).toBe(original);
    expect(recreated.equals(original)).toBe(true);
  });

  it('should correctly compare two NotificationId instances for equality', () => {
    const id1 = NotificationId.create('NOTIF-999');
    const id2 = NotificationId.create('NOTIF-999');
    const id3 = NotificationId.create('NOTIF-888');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
    expect(id1.equals(undefined)).toBe(false);
  });
});
