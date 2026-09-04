import { ApprovalRequest, ApprovalRequestStatus, ApprovalDecisionRecord } from '../../../src/domain/approval/ApprovalRequest';

describe('ApprovalRequest Entity', () => {
  const createRequest = (status = ApprovalRequestStatus.Pending, currentStep = 0, decisions: ApprovalDecisionRecord[] = []) => {
    return new ApprovalRequest(
      'req-1', 'tenant-1', 'wf-1', 'PurchaseOrder', 'po-1', 'req-1', { totalValue: 100 }, 2,
      status, currentStep, decisions
    );
  };

  const createDecision = (stepIndex: number, decision: 'APPROVED' | 'REJECTED'): ApprovalDecisionRecord => ({
    id: 'dec-1',
    stepIndex,
    deciderId: 'decider-1',
    decision,
    decidedAt: new Date()
  });

  describe('approve', () => {
    it('approve() records decision and stays PENDING when requiredCount not met', () => {
      const request = createRequest();
      request.approve(createDecision(0, 'APPROVED'), 2);
      expect(request.status).toBe(ApprovalRequestStatus.Pending);
      expect(request.currentStep).toBe(0);
      expect(request.decisions.length).toBe(1);
    });

    it('approve() advances step when requiredCount met at non-final step', () => {
      const request = createRequest();
      request.approve(createDecision(0, 'APPROVED'), 1);
      expect(request.status).toBe(ApprovalRequestStatus.Pending);
      expect(request.currentStep).toBe(1);
      expect(request.decisions.length).toBe(1);
    });

    it('approve() transitions to APPROVED when all steps complete', () => {
      const request = createRequest(ApprovalRequestStatus.Pending, 1); // 2 steps total
      request.approve(createDecision(1, 'APPROVED'), 1);
      expect(request.status).toBe(ApprovalRequestStatus.Approved);
      expect(request.currentStep).toBe(1);
    });

    it('approve() throws when status is not PENDING', () => {
      const request = createRequest(ApprovalRequestStatus.Approved);
      expect(() => request.approve(createDecision(0, 'APPROVED'), 1))
        .toThrow(`Cannot approve request in status: ${ApprovalRequestStatus.Approved}`);
    });

    it("approve() throws when stepIndex doesn't match currentStep", () => {
      const request = createRequest();
      expect(() => request.approve(createDecision(1, 'APPROVED'), 1))
        .toThrow('Decision step 1 does not match current step 0.');
    });
  });

  describe('reject', () => {
    it('reject() immediately transitions to REJECTED', () => {
      const request = createRequest();
      request.reject(createDecision(0, 'REJECTED'));
      expect(request.status).toBe(ApprovalRequestStatus.Rejected);
    });

    it('reject() throws when status is not PENDING', () => {
      const request = createRequest(ApprovalRequestStatus.Expired);
      expect(() => request.reject(createDecision(0, 'REJECTED')))
        .toThrow(`Cannot reject request in status: ${ApprovalRequestStatus.Expired}`);
    });

    it('reject() throws when decision is not REJECTED', () => {
      const request = createRequest();
      expect(() => request.reject(createDecision(0, 'APPROVED')))
        .toThrow('Rejection decision must have decision = REJECTED.');
    });
  });

  describe('escalate', () => {
    it('escalate() advances step on timeout', () => {
      const request = createRequest();
      request.escalate();
      expect(request.currentStep).toBe(1);
      expect(request.status).toBe(ApprovalRequestStatus.Escalated);
    });

    it('escalate() transitions to EXPIRED at final step', () => {
      const request = createRequest(ApprovalRequestStatus.Pending, 1);
      request.escalate();
      expect(request.currentStep).toBe(1);
      expect(request.status).toBe(ApprovalRequestStatus.Expired);
    });

    it('escalate() throws when status is already terminal (APPROVED/REJECTED)', () => {
      const request = createRequest(ApprovalRequestStatus.Approved);
      expect(() => request.escalate())
        .toThrow(`Cannot escalate request in status: ${ApprovalRequestStatus.Approved}`);
    });
  });

  describe('expire', () => {
    it('expire() force-expires PENDING requests', () => {
      const request = createRequest(ApprovalRequestStatus.Pending);
      request.expire();
      expect(request.status).toBe(ApprovalRequestStatus.Expired);
    });

    it('expire() force-expires ESCALATED requests', () => {
      const request = createRequest(ApprovalRequestStatus.Escalated);
      request.expire();
      expect(request.status).toBe(ApprovalRequestStatus.Expired);
    });

    it('expire() throws when already APPROVED', () => {
      const request = createRequest(ApprovalRequestStatus.Approved);
      expect(() => request.expire())
        .toThrow(`Cannot expire request in status: ${ApprovalRequestStatus.Approved}`);
    });
  });

  describe('isPending', () => {
    it('isPending returns true for PENDING and ESCALATED', () => {
      const req1 = createRequest(ApprovalRequestStatus.Pending);
      const req2 = createRequest(ApprovalRequestStatus.Escalated);
      expect(req1.isPending).toBe(true);
      expect(req2.isPending).toBe(true);
    });

    it('isPending returns false for APPROVED, REJECTED, EXPIRED', () => {
      const req1 = createRequest(ApprovalRequestStatus.Approved);
      const req2 = createRequest(ApprovalRequestStatus.Rejected);
      const req3 = createRequest(ApprovalRequestStatus.Expired);
      expect(req1.isPending).toBe(false);
      expect(req2.isPending).toBe(false);
      expect(req3.isPending).toBe(false);
    });
  });

  describe('reconstruct', () => {
    it('reconstruct() creates instance with correct state', () => {
      const decisions = [createDecision(0, 'APPROVED')];
      const request = ApprovalRequest.reconstruct(
        'req-1', 'tenant-1', 'wf-1', 'Type', 'ref-1', 'requester',
        { a: 1 }, 2, ApprovalRequestStatus.Pending, 1, decisions
      );

      expect(request.id).toBe('req-1');
      expect(request.tenantId).toBe('tenant-1');
      expect(request.status).toBe(ApprovalRequestStatus.Pending);
      expect(request.currentStep).toBe(1);
      expect(request.decisions).toEqual(decisions);
      expect(request.payload).toEqual({ a: 1 });
      expect(request.totalSteps).toBe(2);
    });
  });
});
