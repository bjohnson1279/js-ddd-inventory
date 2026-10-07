import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import { TenantRegistry } from '../../database/TenantRegistry';
import { TenantConnectionPool } from '../../database/TenantConnectionPool';
import { TenantProvisioner } from '../../database/TenantProvisioner';

export function createTenantAdminRoutes(
  registry: TenantRegistry,
  pool: TenantConnectionPool,
  provisioner: TenantProvisioner
): FastifyPluginAsync {
  return async (fastify) => {

    fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as { tenantId?: string };
        const tenantId = body?.tenantId;
        if (!tenantId) {
          return reply.status(400).send({ error: 'tenantId is required' });
        }

        const schemaName = await provisioner.provisionTenant(tenantId);

        return reply.status(201).send({
          tenantId,
          schemaName,
          status: 'ACTIVE',
          message: `Tenant "${tenantId}" provisioned successfully.`,
        });
      } catch (err: any) {
        return reply.status(409).send({ error: err.message });
      }
    });

    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { status?: string };
        const status = query.status;
        const tenants = await registry.listTenants(status);
        return reply.send({ tenants });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    fastify.get('/pool', async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = pool.getStats();
        return reply.send(stats);
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = request.params as { id: string };
        const tenant = await registry.lookupTenant(params.id);
        if (!tenant) {
          return reply.status(404).send({ error: `Tenant "${params.id}" not found.` });
        }
        return reply.send(tenant);
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = request.params as { id: string };
        await pool.evict(params.id);
        await provisioner.deprovisionTenant(params.id);
        return reply.send({ message: `Tenant "${params.id}" deprovisioned.` });
      } catch (err: any) {
        return reply.status(404).send({ error: err.message });
      }
    });

  };
}
