import { Router } from 'express';

export const cycleCountRouter = Router();

cycleCountRouter.post('/start', (req, res) => {
  res.json({ id: 'cc-123', status: 'PENDING' });
});

cycleCountRouter.post('/:id/submit', (req, res) => {
  res.json({ success: true });
});

cycleCountRouter.get('/', (req, res) => {
  res.json([]);
});
