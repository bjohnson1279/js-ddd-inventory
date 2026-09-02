import request from 'supertest';
import express from 'express';

// Mock the prisma export
jest.mock('../../../src/infrastructure/database/prisma', () => {
  return {
    prisma: {
      approvalWorkflowModel: {
        update: jest.fn().mockResolvedValue({ id: 'some-uuid', isActive: false }),
        findUnique: jest.fn().mockResolvedValue({ id: 'some-uuid', isActive: true })
      },
      approvalRequestModel: {
        findMany: jest.fn().mockResolvedValue([])
      }
    }
  };
});

// Mock the auth middleware explicitly for tests
jest.mock('../../../src/infrastructure/http/middleware/auth', () => ({
  requirePermission: () => (req: any, res: any, next: any) => {
    req.tenantId = 'tenant-1';
    req.userId = 'user-1';
    next();
  }
}));

import approvalRouter from '../../../src/infrastructure/http/routes/approval.routes';

const app = express();
app.use(express.json());
app.use('/api/approvals', approvalRouter);

describe('Approval E2E', () => {
  it('should toggle a workflow', async () => {
    const res = await request(app)
      .post('/api/approvals/workflows/some-uuid/toggle');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 'some-uuid');
    expect(res.body).toHaveProperty('isActive', false);
  });

  it('should list pending requests', async () => {
    const res = await request(app)
      .get('/api/approvals/pending');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
