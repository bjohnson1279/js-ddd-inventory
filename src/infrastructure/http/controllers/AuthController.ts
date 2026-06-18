import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../../database/prisma";
import { hashPassword, verifyPassword } from "../../utils/security";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required for security.");
}

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

  static async listUsers(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;

      const userModels = await prisma.userModel.findMany({
        where: { tenantId },
        include: {
          userRoles: {
            include: { role: true }
          }
        }
      });

      const users = userModels.map((u: any) => {
        const role = u.userRoles.length > 0 ? u.userRoles[0].role.id : "staff";
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          role,
          active: u.active
        };
      });

      return res.status(200).json({ users });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async inviteUser(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { email, role } = req.body;

      if (!email || !role) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await prisma.userModel.findFirst({
        where: { tenantId, email: normalizedEmail }
      });
      if (existing) {
        return res.status(400).json({ error: "User already exists." });
      }

      const userId = crypto.randomUUID();
      const tempPassword = crypto.randomBytes(6).toString("hex");
      const passwordHash = hashPassword(tempPassword);

      await prisma.userModel.create({
        data: {
          id: userId,
          tenantId,
          email: normalizedEmail,
          passwordHash,
          name: normalizedEmail.split("@")[0],
          active: true
        }
      });

      const roleExists = await prisma.roleModel.findUnique({ where: { id: role } });
      if (!roleExists) {
        await prisma.roleModel.create({
          data: { id: role, name: role.replace("_", " ") }
        });
      }

      await prisma.userRoleModel.create({
        data: {
          userId,
          roleId: role
        }
      });

      return res.status(201).json({
        message: "User invited successfully.",
        userId,
        temporaryPassword: tempPassword
      });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async updateUserRole(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { userId } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ error: "Role is required" });
      }

      const user = await prisma.userModel.findFirst({
        where: { id: userId, tenantId }
      });
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      await prisma.userRoleModel.deleteMany({
        where: { userId }
      });

      const roleExists = await prisma.roleModel.findUnique({ where: { id: role } });
      if (!roleExists) {
        await prisma.roleModel.create({
          data: { id: role, name: role.replace("_", " ") }
        });
      }

      await prisma.userRoleModel.create({
        data: {
          userId,
          roleId: role
        }
      });

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
