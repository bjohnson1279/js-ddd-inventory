import request from 'supertest';
import express from 'express';
import { cycleCountRouter } from '../../../src/infrastructure/http/routes/cycleCount.routes';

const app = express();
app.use(express.json());
app.use('/api/cycle-counts', cycleCountRouter);

describe('CycleCount E2E', () => {
  it('should create a cycle count plan', async () => {
    const res = await request(app)
      .post('/api/cycle-counts/plans')
      .send({
        tenantId: 'tenant-1',
        name: 'Daily A-Items',
        abcClassification: 'A',
        frequencyDays: 30
      });
    
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Daily A-Items');
  });

  it('should schedule cycle counts based on active plans', async () => {
    const res = await request(app)
      .post('/api/cycle-counts/schedule')
      .send({ tenantId: 'tenant-1' });
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('scheduled');
    expect(res.body).toHaveProperty('audits');
  });
});
