import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { prisma } from "../../database/prisma";
import { DomainException } from "../../../domain/exceptions/DomainException";
import { Logger } from "../../../infrastructure/logging/logger";


// Store active SSE clients: tenantId -> FastifyReply[]
const sseClients = new Map<string, FastifyReply[]>();

const inMemoryNotifications = new Map<string, any>();

export class NotificationController {
  static async list(request: any, reply: any) {
    try {
      const tenantId = (request as any).tenantId || "tenant-1";
      let notifications: any[] = [];
      try {
        notifications = await prisma.notificationModel.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" }
        });
      } catch (e) {
        notifications = Array.from(inMemoryNotifications.values())
          .filter(n => n.tenantId === tenantId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      reply.status(200).send(notifications);
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "NotificationController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "NotificationController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async read(request: any, reply: any) {
    try {
      const { id } = (request.params as any);
      const tenantId = (request as any).tenantId || "tenant-1";

      let notification: any = inMemoryNotifications.get(id);
      if (notification && notification.tenantId === tenantId) {
        notification.isRead = true;
      }

      try {
        const dbNotif = await prisma.notificationModel.findUnique({
          where: { id }
        });
        if (dbNotif && dbNotif.tenantId === tenantId) {
          notification = await prisma.notificationModel.update({
            where: { id },
            data: { isRead: true }
          });
        }
      } catch (e) {}

      if (!notification || notification.tenantId !== tenantId) {
        return reply.status(404).send({ error: "Notification not found" });
      }

      reply.status(200).send(notification);
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "NotificationController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "NotificationController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async readAll(request: any, reply: any) {
    try {
      const tenantId = (request as any).tenantId || "tenant-1";

      for (const n of inMemoryNotifications.values()) {
        if (n.tenantId === tenantId) {
          n.isRead = true;
        }
      }

      try {
        await prisma.notificationModel.updateMany({
          where: { tenantId, isRead: false },
          data: { isRead: true }
        });
      } catch (e) {}

      reply.status(200).send({ message: "All notifications marked as read" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "NotificationController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "NotificationController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static async subscribe(request: any, reply: any) {
    const tenantId = (request as any).tenantId || "tenant-1";

    reply.header("Content-Type", "text/event-stream");
    reply.header("Cache-Control", "no-cache");
    reply.header("Connection", "keep-alive");
    reply.header("Content-Encoding", "none");

    // Send initial connection message
    reply.raw.write("data: " + JSON.stringify({ status: "connected" }) + "\n\n");

    if (!sseClients.has(tenantId)) {
      sseClients.set(tenantId, []);
    }
    sseClients.get(tenantId)!.push(reply);

    request.raw.on("close", () => {
      const clients = sseClients.get(tenantId) || [];
      sseClients.set(tenantId, clients.filter((client) => client !== reply));
    });
  }

  // Create notification and broadcast it to connected clients
  static async create(request: any, reply: any) {
    try {
      const tenantId = (request as any).tenantId || "tenant-1";
      const { title, message, type } = (request.body as any);

      if (!title || !message) {
        return reply.status(400).send({ error: "Title and message are required" });
      }

      const id = crypto.randomUUID();
      const notification = {
        id,
        tenantId,
        title,
        message,
        type: type || "info",
        isRead: false,
        createdAt: new Date()
      };
      inMemoryNotifications.set(id, notification);

      try {
        await prisma.notificationModel.create({
          data: {
            id,
            tenantId,
            title,
            message,
            type: type || "info",
            isRead: false
          }
        });
      } catch (e) {}

      // Broadcast to SSE clients
      NotificationController.broadcastToTenant(tenantId, notification);

      reply.status(201).send(notification);
    } catch (error: any) {
      if (error instanceof DomainException) {
        Logger.error({ context: "NotificationController", message: "An error occurred", error: error.message });
        reply.status(400).send({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        Logger.error({ context: "NotificationController", message: "An error occurred", error: error });
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  }

  static broadcastToTenant(tenantId: string, data: any) {
    const clients = sseClients.get(tenantId) || [];
    for (const client of clients) {
      client.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }
}
