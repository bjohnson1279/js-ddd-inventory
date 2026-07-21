import { Logger } from "../../logging/logger";
import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../../database/prisma";
import crypto from "crypto";

export class WebhookSubscriptionController {
  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const { targetUrl, secret, eventTypes } = req.body;
      if (!targetUrl || !secret || !eventTypes || !Array.isArray(eventTypes)) {
        return res.status(400).json({ error: "Missing or invalid parameters" });
      }
      const tenantId = req.tenantId || "tenant-1";
      const subscription = await prisma.webhookSubscriptionModel.create({
        data: {
          id: crypto.randomUUID(),
          tenantId,
          targetUrl,
          secret,
          eventTypes,
          isActive: true
        }
      });
      res.status(201).json(subscription);
    } catch (err: any) {
      Logger.error({ context: "WebhookSubscriptionController" }, err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId || "tenant-1";
      const subscriptions = await prisma.webhookSubscriptionModel.findMany({
        where: { tenantId }
      });
      res.status(200).json(subscriptions);
    } catch (err: any) {
      Logger.error({ context: "WebhookSubscriptionController" }, err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { targetUrl, secret, eventTypes, isActive } = req.body;
      const tenantId = req.tenantId || "tenant-1";

      const sub = await prisma.webhookSubscriptionModel.findUnique({ where: { id } });
      if (!sub || sub.tenantId !== tenantId) {
        return res.status(404).json({ error: "Webhook subscription not found" });
      }

      const updated = await prisma.webhookSubscriptionModel.update({
        where: { id },
        data: {
          targetUrl: targetUrl !== undefined ? targetUrl : undefined,
          secret: secret !== undefined ? secret : undefined,
          eventTypes: eventTypes !== undefined ? eventTypes : undefined,
          isActive: isActive !== undefined ? isActive : undefined
        }
      });
      res.status(200).json(updated);
    } catch (err: any) {
      Logger.error({ context: "WebhookSubscriptionController" }, err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId || "tenant-1";

      const sub = await prisma.webhookSubscriptionModel.findUnique({ where: { id } });
      if (!sub || sub.tenantId !== tenantId) {
        return res.status(404).json({ error: "Webhook subscription not found" });
      }

      await prisma.webhookSubscriptionModel.delete({ where: { id } });
      res.status(204).send();
    } catch (err: any) {
      Logger.error({ context: "WebhookSubscriptionController" }, err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
