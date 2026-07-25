import { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import * as mqtt from "mqtt";

export class RfidController {
  static async list(req: Request, res: Response) {
    try {
      const tags = await prisma.rfidTagModel.findMany({
        orderBy: { createdAt: "desc" }
      });
      res.status(200).json({ tags });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
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
            return res.status(500).json({ error: "Failed to publish MQTT message: " + err.message });
          }
          res.status(200).json({ message: "RFID scan simulation published." });
        });
      });

      client.on("error", (err) => {
        client.end();
        res.status(500).json({ error: "MQTT Connection Error: " + err.message });
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
