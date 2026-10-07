import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../../database/prisma";
import crypto from "crypto";
import { Logger } from "../../../infrastructure/logging/logger";
import { encrypt } from "../../utils/encryption";

export class WebhookSubscriptionController {
  static async create(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { targetUrl, secret, eventTypes } = request.body;
      if (!targetUrl || !secret || !eventTypes || !Array.isArray(eventTypes)) {
        return reply.status(400).send({ error: "Missing or invalid parameters" });
      }
      const tenantId = request.tenantId || "tenant-1";
      const subscription = await prisma.webhookSubscriptionModel.create({
        data: {
          id: crypto.randomUUID(),
          tenantId,
          targetUrl,
          secret: encrypt(secret),
          eventTypes,
          isActive: true
        }
      });
      reply.status(201).send(subscription);
    } catch (err: any) {
      Logger.error({ context: "WebhookSubscriptionController", message: err.message });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async list(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.tenantId || "tenant-1";
      const subscriptions = await prisma.webhookSubscriptionModel.findMany({
        where: { tenantId }
      });
      reply.status(200).send(subscriptions);
    } catch (err: any) {
      Logger.error({ context: "WebhookSubscriptionController", message: err.message });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async update(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = request.params;
      const { targetUrl, secret, eventTypes, isActive } = request.body;
      const tenantId = request.tenantId || "tenant-1";

      const sub = await prisma.webhookSubscriptionModel.findUnique({ where: { id } });
      if (!sub || sub.tenantId !== tenantId) {
        return reply.status(404).send({ error: "Webhook subscription not found" });
      }

      const updated = await prisma.webhookSubscriptionModel.update({
        where: { id },
        data: {
          targetUrl: targetUrl !== undefined ? targetUrl : undefined,
          secret: secret !== undefined ? encrypt(secret) : undefined,
          eventTypes: eventTypes !== undefined ? eventTypes : undefined,
          isActive: isActive !== undefined ? isActive : undefined
        }
      });
      reply.status(200).send(updated);
    } catch (err: any) {
      Logger.error({ context: "WebhookSubscriptionController", message: err.message });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async delete(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { id } = request.params;
      const tenantId = request.tenantId || "tenant-1";

      const sub = await prisma.webhookSubscriptionModel.findUnique({ where: { id } });
      if (!sub || sub.tenantId !== tenantId) {
        return reply.status(404).send({ error: "Webhook subscription not found" });
      }

      await prisma.webhookSubscriptionModel.delete({ where: { id } });
      reply.status(204).send();
    } catch (err: any) {
      Logger.error({ context: "WebhookSubscriptionController", message: err.message });
      reply.status(500).send({ error: "Internal server error" });
    }
  }
}
