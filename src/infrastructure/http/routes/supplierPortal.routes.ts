import { Router } from 'express';

export const supplierPortalRouter = Router();

supplierPortalRouter.post('/asn', (req, res) => {
  res.json({ id: 'asn-123', status: 'SUBMITTED' });
});

supplierPortalRouter.get('/asn', (req, res) => {
  res.json([]);
});
