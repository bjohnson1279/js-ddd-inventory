import { ApprovalRequestId } from '../../../../src/domain/approval/valueObjects/ApprovalRequestId';

describe('ApprovalRequestId Value Object', () => {
  it('should generate a valid random ApprovalRequestId when created with no argument', () => {
    const id1 = ApprovalRequestId.create();
    const id2 = ApprovalRequestId.create();

    expect(id1.getValue()).toBeDefined();
    expect(typeof id1.getValue()).toBe('string');
    expect(id1.getValue().length).toBeGreaterThan(0);
    expect(id1.equals(id2)).toBe(false);
  });

  it('should create an ApprovalRequestId with specified string value', () => {
    const customStr = 'APPROVAL-12345';
    const id = ApprovalRequestId.create(customStr);

    expect(id.getValue()).toBe(customStr);
  });

  it('should trim string when creating ApprovalRequestId', () => {
    const customStr = '  APPROVAL-TRIMMED  ';
    const id = ApprovalRequestId.create(customStr);

    expect(id.getValue()).toBe('APPROVAL-TRIMMED');
  });

  it('should generate a random id if empty or whitespace string is passed', () => {
    const id = ApprovalRequestId.create('   ');
    expect(id.getValue()).toBeDefined();
    expect(id.getValue().length).toBeGreaterThan(0);
    expect(id.getValue()).not.toBe('   ');
  });

  it('should return the same instance if an ApprovalRequestId is passed to create', () => {
    const original = ApprovalRequestId.create('APPROVAL-ORIG');
    const recreated = ApprovalRequestId.create(original);

    expect(recreated).toBe(original);
    expect(recreated.equals(original)).toBe(true);
  });

  it('should correctly compare two ApprovalRequestId instances for equality', () => {
    const id1 = ApprovalRequestId.create('APPROVAL-999');
    const id2 = ApprovalRequestId.create('APPROVAL-999');
    const id3 = ApprovalRequestId.create('APPROVAL-888');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
    expect(id1.equals(undefined)).toBe(false);
  });
});
