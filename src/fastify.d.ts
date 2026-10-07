import 'fastify';
import { InventoryPrismaRepository } from './infrastructure/database/InventoryPrismaRepository';
import { ReportPrismaRepository } from './infrastructure/database/ReportPrismaRepository';
import { ShipmentPrismaRepository } from './infrastructure/database/ShipmentPrismaRepository';
import { OutboxPrismaRepository } from './infrastructure/database/OutboxPrismaRepository';

declare module 'fastify' {
  interface FastifyInstance {
    inventoryRepository: InventoryPrismaRepository;
    reportRepository: ReportPrismaRepository;
    shipmentRepository: ShipmentPrismaRepository;
    outboxRepository: OutboxPrismaRepository;
  }
}
