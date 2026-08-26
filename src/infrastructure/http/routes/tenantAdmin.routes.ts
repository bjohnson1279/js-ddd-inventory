import { Router, Request, Response } from 'express';
import { TenantRegistry } from '../../database/TenantRegistry';
import { TenantConnectionPool } from '../../database/TenantConnectionPool';
import { TenantProvisioner } from '../../database/TenantProvisioner';

/**
 * REST routes for tenant administration (Roadmap 6.1).
 *
 * POST   /admin/tenants          — Provision a new tenant
 * GET    /admin/tenants          — List all tenants
 * GET    /admin/tenants/:id      — Get tenant details
 * DELETE /admin/tenants/:id      — Deprovision a tenant
 * GET    /admin/tenants/pool     — Get connection pool stats
 */
export function createTenantAdminRoutes(
  registry: TenantRegistry,
  pool: TenantConnectionPool,
  provisioner: TenantProvisioner
): Router {
  const router = Router();

  // Provision a new tenant
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required' });
      }

      const schemaName = await provisioner.provisionTenant(tenantId);

      res.status(201).json({
        tenantId,
        schemaName,
        status: 'ACTIVE',
        message: `Tenant "${tenantId}" provisioned successfully.`,
      });
    } catch (err: any) {
      res.status(409).json({ error: err.message });
    }
  });

  // List all tenants
  router.get('/', async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const tenants = await registry.listTenants(status);
      res.json({ tenants });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get connection pool stats
  router.get('/pool', async (_req: Request, res: Response) => {
    try {
      const stats = pool.getStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get tenant details
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const tenant = await registry.lookupTenant(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: `Tenant "${req.params.id}" not found.` });
      }
      res.json(tenant);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Deprovision a tenant
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      // Evict from connection pool first
      await pool.evict(req.params.id);
      // Then deprovision
      await provisioner.deprovisionTenant(req.params.id);

      res.json({ message: `Tenant "${req.params.id}" deprovisioned.` });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  return router;
}
