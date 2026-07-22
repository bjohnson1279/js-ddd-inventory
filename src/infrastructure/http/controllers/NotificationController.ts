import { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { DomainException } from "../../../domain/exceptions/DomainException";


// Store active SSE clients: tenantId -> Response[]
const sseClients = new Map<string, Response[]>();

export class NotificationController {
  static async list(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId || "tenant-1";
      const notifications = await prisma.notificationModel.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" }
      });
      res.status(200).json(notifications);
    } catch (error: any) {
      if (error instanceof DomainException) {
        console.error(error.message);
        res.status(400).json({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async read(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = (req as any).tenantId || "tenant-1";

      const notification = await prisma.notificationModel.findUnique({
        where: { id }
      });

      if (!notification || notification.tenantId !== tenantId) {
        return res.status(404).json({ error: "Notification not found" });
      }

      const updated = await prisma.notificationModel.update({
        where: { id },
        data: { isRead: true }
      });

      res.status(200).json(updated);
    } catch (error: any) {
      if (error instanceof DomainException) {
        console.error(error.message);
        res.status(400).json({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async readAll(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId || "tenant-1";

      await prisma.notificationModel.updateMany({
        where: { tenantId, isRead: false },
        data: { isRead: true }
      });

      res.status(200).json({ message: "All notifications marked as read" });
    } catch (error: any) {
      if (error instanceof DomainException) {
        console.error(error.message);
        res.status(400).json({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async subscribe(req: Request, res: Response) {
    const tenantId = (req as any).tenantId || "tenant-1";

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Content-Encoding", "none");

    // Send initial connection message
    res.write("data: " + JSON.stringify({ status: "connected" }) + "\n\n");

    if (!sseClients.has(tenantId)) {
      sseClients.set(tenantId, []);
    }
    sseClients.get(tenantId)!.push(res);

    req.on("close", () => {
      const clients = sseClients.get(tenantId) || [];
      sseClients.set(tenantId, clients.filter((client) => client !== res));
    });
  }

  // Create notification and broadcast it to connected clients
  static async create(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId || "tenant-1";
      const { title, message, type } = req.body;

      if (!title || !message) {
        return res.status(400).json({ error: "Title and message are required" });
      }

      const notification = await prisma.notificationModel.create({
        data: {
          tenantId,
          title,
          message,
          type: type || "info",
          isRead: false
        }
      });

      // Broadcast to SSE clients
      NotificationController.broadcastToTenant(tenantId, notification);

      res.status(201).json(notification);
    } catch (error: any) {
      if (error instanceof DomainException) {
        console.error(error.message);
        res.status(400).json({ error: "A domain error occurred while processing the request.", type: error.name });
      } else {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static broadcastToTenant(tenantId: string, data: any) {
    const clients = sseClients.get(tenantId) || [];
    for (const client of clients) {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }
}
