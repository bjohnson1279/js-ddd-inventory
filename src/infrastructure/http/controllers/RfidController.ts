import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { prisma } from "../../database/prisma";
import * as mqtt from "mqtt";
import { Logger } from "../../logging/logger";

export class RfidController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tags = await prisma.rfidTagModel.findMany({
        orderBy: { createdAt: "desc" }
      });
      reply.status(200).send({ tags });
    } catch (error: any) {
      Logger.error({ context: "RfidController", message: "An error occurred", error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async assign(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { epc, sku, serialNumber } = request.body;
      if (!epc || !sku || !serialNumber) {
        return reply.status(400).send({ error: "Missing required fields: epc, sku, serialNumber" });
      }
      if (!/^[0-9A-Fa-f]{24}$/.test(epc)) {
        return reply.status(400).send({ error: "RFID EPC must be a 24-character hexadecimal string." });
      }

      const tag = await prisma.rfidTagModel.create({
        data: {
          epc,
          sku,
          serialNumber,
          status: "ACTIVE"
        }
      });
      reply.status(201).send({ message: "Tag assigned successfully", tag });
    } catch (error: any) {
      Logger.error({ context: "RfidController", message: "An error occurred", error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }

  static async simulateScan(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { locationId, tags } = request.body;
      if (!locationId || !tags || !Array.isArray(tags)) {
        return reply.status(400).send({ error: "Missing required fields: locationId, tags (array of EPC strings)" });
      }

      const tenantId = (req as any).tenantId || "tenant-1";
      const client = mqtt.connect(process.env.MQTT_URL || "mqtt://localhost:1883");
      const payload = {
        locationId,
        tags: tags.map(epc => ({ epc }))
      };

      client.on("connect", () => {
        client.publish(`tenants/${tenantId}/rfid/scans`, JSON.stringify(payload), { qos: 0 }, (err) => {
          client.end();
          if (err) {
            Logger.error({ context: "RfidController", message: "Failed to publish MQTT message", error: err });
            return reply.status(500).send({ error: "Internal server error" });
          }
          reply.status(200).send({ message: "RFID scan simulation published." });
        });
      });

      client.on("error", (err) => {
        client.end();
        Logger.error({ context: "RfidController", message: "MQTT Connection Error", error: err });
        reply.status(500).send({ error: "Internal server error" });
      });
    } catch (error: any) {
      Logger.error({ context: "RfidController", message: "An error occurred", error });
      reply.status(500).send({ error: "Internal server error" });
    }
  }
}
