import { ApprovalRequest, ApprovalRequestStatus, ApprovalDecisionRecord } from '../../../src/domain/approval/ApprovalRequest';

describe('ApprovalRequest', () => {
  const createRequest = (totalSteps: number, status = ApprovalRequestStatus.Pending, currentStep = 0) => {
    return new ApprovalRequest(
      'req-1', 'tenant-1', 'wf-1', 'Type', 'ref-1', 'req-1', {}, totalSteps, status, currentStep, []
    );
  };

  const createDecision = (stepIndex: number, decision: 'APPROVED' | 'REJECTED'): ApprovalDecisionRecord => ({
    id: 'dec-1',
    stepIndex,
    deciderId: 'decider-1',
    decision,
    decidedAt: new Date()
  });

  it('approve stays PENDING when requiredCount not met', () => {
    const req = createRequest(1);
    req.approve(createDecision(0, 'APPROVED'), 2);
    expect(req.status).toBe(ApprovalRequestStatus.Pending);
    expect(req.currentStep).toBe(0);
  });

  it('approve advances step when count met at non-final step', () => {
    const req = createRequest(3);
    req.approve(createDecision(0, 'APPROVED'), 1);
    expect(req.status).toBe(ApprovalRequestStatus.Pending);
    expect(req.currentStep).toBe(1);
  });

  it('approve transitions to APPROVED at final step', () => {
    const req = createRequest(1);
    req.approve(createDecision(0, 'APPROVED'), 1);
    expect(req.status).toBe(ApprovalRequestStatus.Approved);
  });

  it('approve throws when not PENDING', () => {
    const req = createRequest(1, ApprovalRequestStatus.Approved);
    expect(() => req.approve(createDecision(0, 'APPROVED'), 1)).toThrow();
  });

  it('approve throws on step mismatch', () => {
    const req = createRequest(2);
    expect(() => req.approve(createDecision(1, 'APPROVED'), 1)).toThrow();
  });

  it('reject immediately transitions', () => {
    const req = createRequest(2);
    req.reject(createDecision(0, 'REJECTED'));
    expect(req.status).toBe(ApprovalRequestStatus.Rejected);
  });

  it('reject throws when not PENDING', () => {
    const req = createRequest(1, ApprovalRequestStatus.Approved);
    expect(() => req.reject(createDecision(0, 'REJECTED'))).toThrow();
  });

  it('escalate advances step / expires at final', () => {
    const req = createRequest(2);
    req.escalate();
    expect(req.status).toBe(ApprovalRequestStatus.Escalated);
    expect(req.currentStep).toBe(1);

    req.escalate();
    expect(req.status).toBe(ApprovalRequestStatus.Expired);
  });

  it('escalate throws on terminal status', () => {
    const req = createRequest(1, ApprovalRequestStatus.Approved);
    expect(() => req.escalate()).toThrow();
  });

  it('expire works on PENDING/ESCALATED, throws on APPROVED', () => {
    const req = createRequest(1);
    req.expire();
    expect(req.status).toBe(ApprovalRequestStatus.Expired);

    const req2 = createRequest(2, ApprovalRequestStatus.Escalated, 1);
    req2.expire();
    expect(req2.status).toBe(ApprovalRequestStatus.Expired);

    const req3 = createRequest(1, ApprovalRequestStatus.Approved);
    expect(() => req3.expire()).toThrow();
  });

  it('isPending correct for all statuses', () => {
    expect(createRequest(1, ApprovalRequestStatus.Pending).isPending).toBe(true);
    expect(createRequest(1, ApprovalRequestStatus.Escalated).isPending).toBe(true);
    expect(createRequest(1, ApprovalRequestStatus.Approved).isPending).toBe(false);
    expect(createRequest(1, ApprovalRequestStatus.Rejected).isPending).toBe(false);
    expect(createRequest(1, ApprovalRequestStatus.Expired).isPending).toBe(false);
  });

  it('reconstruct creates correct state', () => {
    const req = ApprovalRequest.reconstruct(
      'id', 'tenant', 'wf', 'Type', 'ref', 'req', { a: 1 }, 2, ApprovalRequestStatus.Escalated, 1, [], new Date()
    );
    expect(req.id).toBe('id');
    expect(req.status).toBe(ApprovalRequestStatus.Escalated);
  });
});
