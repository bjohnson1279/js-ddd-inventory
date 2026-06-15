import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../../database/prisma";
import { hashPassword, verifyPassword } from "../../utils/security";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

export class AuthController {
  static async setup(req: Request, res: Response) {
    try {
      const { orgName, tenantId, adminName, adminEmail, adminPassword } = req.body;

      if (!orgName || !tenantId || !adminName || !adminEmail || !adminPassword) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      let tenant = await prisma.tenantModel.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        tenant = await prisma.tenantModel.create({
          data: { id: tenantId, name: orgName }
        });
      }

      const roles = ["admin", "warehouse_operator", "accountant", "viewer"];
      for (const r of roles) {
        const roleExists = await prisma.roleModel.findUnique({ where: { id: r } });
        if (!roleExists) {
          await prisma.roleModel.create({
            data: { id: r, name: r.replace("_", " ") }
          });
        }
      }

      const email = adminEmail.toLowerCase().trim();
      const existing = await prisma.userModel.findFirst({
        where: { tenantId, email }
      });
      if (existing) {
        return res.status(400).json({ error: `Admin user with email ${email} already exists for tenant.` });
      }

      const adminId = crypto.randomUUID();
      const passwordHash = hashPassword(adminPassword);
      await prisma.userModel.create({
        data: {
          id: adminId,
          tenantId,
          email,
          passwordHash,
          name: adminName,
          active: true
        }
      });

      await prisma.userRoleModel.create({
        data: {
          userId: adminId,
          roleId: "admin"
        }
      });

      return res.status(200).json({ success: true, message: "Organization and admin user created successfully." });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { tenantId, email, password } = req.body;

      if (!tenantId || !email || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const user = await prisma.userModel.findFirst({
        where: { tenantId, email: email.toLowerCase().trim() },
        include: {
          userRoles: {
            include: { role: true }
          }
        }
      });

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials." });
      }

      if (!user.active) {
        return res.status(403).json({ error: "Account deactivated." });
      }

      if (!verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: "Invalid credentials." });
      }

      const userRole = user.userRoles.length > 0 ? user.userRoles[0].role.id : "staff";
      const token = jwt.sign(
        { tenantId, actorId: user.id, role: userRole },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      return res.status(200).json({ token });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
