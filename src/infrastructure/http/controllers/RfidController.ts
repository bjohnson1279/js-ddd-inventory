import { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import * as mqtt from "mqtt";
import { Logger } from "../../logging/logger";

export class RfidController {
  static async list(req: Request, res: Response) {
    try {
      const tags = await prisma.rfidTagModel.findMany({
        orderBy: { createdAt: "desc" }
      });
      res.status(200).json({ tags });
    } catch (error: any) {
      Logger.error({ context: "RfidController", message: "An error occurred", error });
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async assign(req: Request, res: Response) {
    try {
      const { epc, sku, serialNumber } = req.body;
      if (!epc || !sku || !serialNumber) {
        return res.status(400).json({ error: "Missing required fields: epc, sku, serialNumber" });
      }
      if (!/^[0-9A-Fa-f]{24}$/.test(epc)) {
        return res.status(400).json({ error: "RFID EPC must be a 24-character hexadecimal string." });
      }

      const tag = await prisma.rfidTagModel.create({
        data: {
          epc,
          sku,
          serialNumber,
          status: "ACTIVE"
        }
      });
      res.status(201).json({ message: "Tag assigned successfully", tag });
    } catch (error: any) {
      Logger.error({ context: "RfidController", message: "An error occurred", error });
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async simulateScan(req: Request, res: Response) {
    try {
      const { locationId, tags } = req.body;
      if (!locationId || !tags || !Array.isArray(tags)) {
        return res.status(400).json({ error: "Missing required fields: locationId, tags (array of EPC strings)" });
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
            return res.status(500).json({ error: "Internal server error" });
          }
          res.status(200).json({ message: "RFID scan simulation published." });
        });
      });

      client.on("error", (err) => {
        client.end();
        Logger.error({ context: "RfidController", message: "MQTT Connection Error", error: err });
        res.status(500).json({ error: "Internal server error" });
      });
    } catch (error: any) {
      Logger.error({ context: "RfidController", message: "An error occurred", error });
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
