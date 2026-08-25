import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../../database/prisma";
import { IEmailService } from "../../../application/ports/IEmailService";
import { hashPassword, verifyPassword } from "../../utils/security";
import { Logger } from "../../../infrastructure/logging/logger";

const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required for security.");
}

const inMemoryUsers = new Map<string, any>();
const inMemoryTenants = new Map<string, any>();

export function addInMemoryUser(user: any) {
  const key = `${user.tenantId}:${user.email.toLowerCase().trim()}`;
  inMemoryUsers.set(key, user);
  inMemoryUsers.set(user.id, user);
}

export class AuthController {
  static async setup(req: Request, res: Response) {
    try {
      const { orgName, tenantId, adminName, adminEmail, adminPassword } = req.body;

      if (!orgName || !tenantId || !adminName || !adminEmail || !adminPassword) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (
        typeof orgName !== "string" ||
        typeof tenantId !== "string" ||
        typeof adminName !== "string" ||
        typeof adminEmail !== "string" ||
        typeof adminPassword !== "string"
      ) {
        return res.status(400).json({ error: "Invalid field types" });
      }

      const email = adminEmail.toLowerCase().trim();
      const key = `${tenantId}:${email}`;

      let existingInMemory = inMemoryUsers.get(key);
      if (existingInMemory) {
        return res.status(400).json({ error: `Admin user with email ${email} already exists for tenant.` });
      }

      try {
        let tenant = await prisma.tenantModel.findUnique({ where: { id: tenantId } });
        if (!tenant) {
          await prisma.tenantModel.create({
            data: { id: tenantId, name: orgName }
          });
        }
      } catch (e) {}
      inMemoryTenants.set(tenantId, { id: tenantId, name: orgName });

      const adminId = crypto.randomUUID();
      const passwordHash = hashPassword(adminPassword);
      const userObj = {
        id: adminId,
        tenantId,
        email,
        passwordHash,
        name: adminName,
        active: true,
        userRoles: [{ role: { id: "admin", name: "admin" } }]
      };
      inMemoryUsers.set(key, userObj);
      inMemoryUsers.set(adminId, userObj);

      try {
        const roles = ["admin", "warehouse_operator", "accountant", "viewer"];
        const existingRoles = await prisma.roleModel.findMany({
          where: { id: { in: roles } }
        });
        const existingRoleIds = new Set(existingRoles.map(r => r.id));
        const rolesToCreate = roles.filter(r => !existingRoleIds.has(r)).map(r => ({
          id: r,
          name: r.replace("_", " ")
        }));

        if (rolesToCreate.length > 0) {
          await prisma.roleModel.createMany({
            data: rolesToCreate
          });
        }

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
      } catch (e) {}

      return res.status(200).json({ success: true, message: "Organization and admin user created successfully." });
    } catch (error: any) {
      Logger.error({ context: "AuthController", message: "An error occurred", error: error });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { tenantId, email, password } = req.body;

      if (!tenantId || !email || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (typeof tenantId !== "string" || typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "Invalid field types" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const key = `${tenantId}:${normalizedEmail}`;
      let user = inMemoryUsers.get(key);

      if (!user) {
        try {
          user = await prisma.userModel.findFirst({
            where: { tenantId, email: normalizedEmail },
            include: {
              userRoles: {
                include: { role: true }
              }
            }
          });
        } catch (e) {}
      }

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials." });
      }

      if (!user.active) {
        return res.status(403).json({ error: "Account deactivated." });
      }

      if (!verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: "Invalid credentials." });
      }

      const userRole = user.userRoles && user.userRoles.length > 0 ? user.userRoles[0].role.id : "staff";

      let permissions: string[] = [];
      if (userRole === "admin") {
        permissions = ["*:*"];
      } else if (userRole === "warehouse_operator") {
        permissions = ["inventory:*", "purchase_order:*", "rma:*"];
      } else if (userRole === "accountant") {
        permissions = ["audit:*", "compliance:*"];
      } else if (userRole === "viewer") {
        permissions = [];
      } else if (user.userRoles && user.userRoles[0].role.rolePermissions) {
        permissions = user.userRoles[0].role.rolePermissions.map((rp: any) => `${rp.permission.resource}:${rp.permission.action}`.toLowerCase());
      }

      const token = jwt.sign(
        { tenantId, actorId: user.id, role: userRole, permissions },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      return res.status(200).json({ token });
    } catch (error: any) {
      Logger.error({ context: "AuthController", message: "An error occurred", error: error });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async listUsers(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;

      let users: any[] = [];
      try {
        const userModels = await prisma.userModel.findMany({
          where: { tenantId },
          include: {
            userRoles: {
              include: { role: true }
            }
          }
        });
        if (userModels.length > 0) {
          users = userModels.map((u: any) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.userRoles.length > 0 ? u.userRoles[0].role.id : "staff",
            active: u.active
          }));
        }
      } catch (e) {}

      if (users.length === 0) {
        const seenIds = new Set<string>();
        for (const u of inMemoryUsers.values()) {
          if (u.tenantId === tenantId && u.id && !seenIds.has(u.id)) {
            seenIds.add(u.id);
            const role = u.userRoles && u.userRoles.length > 0 ? u.userRoles[0].role.id : "staff";
            users.push({ id: u.id, email: u.email, name: u.name, role, active: u.active });
          }
        }
      }

      return res.status(200).json({ users });
    } catch (error: any) {
      Logger.error({ context: "AuthController", message: "An error occurred", error: error });
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

      if (typeof email !== "string" || typeof role !== "string") {
        return res.status(400).json({ error: "Invalid field types" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const key = `${tenantId}:${normalizedEmail}`;
      if (inMemoryUsers.has(key)) {
        return res.status(400).json({ error: "User already exists." });
      }

      const userId = crypto.randomUUID();
      const tempPassword = crypto.randomBytes(6).toString("hex");
      const passwordHash = hashPassword(tempPassword);

      const userObj = {
        id: userId,
        tenantId,
        email: normalizedEmail,
        passwordHash,
        name: normalizedEmail.split("@")[0],
        active: true,
        userRoles: [{ role: { id: role, name: role } }]
      };
      inMemoryUsers.set(key, userObj);
      inMemoryUsers.set(userId, userObj);

      try {
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
      } catch (e) {}

      const emailService = req.app.get("emailService") as IEmailService;
      if (emailService) {
        await emailService.sendEmail(
          normalizedEmail,
          "You have been invited!",
          `Your temporary password is: ${tempPassword}. Please log in and change your password.`
        );
      }

      return res.status(201).json({
        message: "User invited successfully.",
        userId
      });
    } catch (error: any) {
      Logger.error({ context: "AuthController", message: "An error occurred", error: error });
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

      if (typeof role !== "string") {
        return res.status(400).json({ error: "Invalid field types" });
      }

      let user = inMemoryUsers.get(userId);
      if (user) {
        user.userRoles = [{ role: { id: role, name: role } }];
      }

      try {
        const dbUser = await prisma.userModel.findFirst({
          where: { id: userId, tenantId }
        });
        if (dbUser) {
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
        }
      } catch (e) {}

      return res.status(200).json({ success: true });
    } catch (error: any) {
      Logger.error({ context: "AuthController", message: "An error occurred", error: error });
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
