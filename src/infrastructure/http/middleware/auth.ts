import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { tenantLocalStorage } from "../../database/tenantContext";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required for security.");
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;              // Primary role (backward compat)
    roles: string[];           // All assigned role IDs
    permissions: string[];     // Flat permission keys: ['inventory:dispatch', ...]
    email?: string;
    tenantId?: string;
  };
  tenantId?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {

    return res.status(401).json({ error: "Unauthorized: Access token is missing or invalid." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.actorId || decoded.userId,
      role: decoded.role || "viewer",
      roles: decoded.roles || (decoded.role ? [decoded.role] : ["viewer"]),
      permissions: decoded.permissions || [],
      email: decoded.email,
      tenantId: decoded.tenantId || "tenant-1"
    };
    const tenantId = decoded.tenantId || "tenant-1";
    req.tenantId = tenantId;
    tenantLocalStorage.run(tenantId, () => next());
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Access token is missing or invalid." });
  }
}

/**
 * Permission-based authorization middleware.
 * Checks whether the authenticated user's JWT contains the required resource:action permission.
 */
export function requirePermission(resource: string, action: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const required = `${resource}:${action}`;
    if (!req.user?.permissions?.includes(required)) {
      return res.status(403).json({
        error: `Forbidden: Missing permission '${required}'.`
      });
    }
    next();
  };
}

/**
 * Role-based authorization middleware (backward compatible).
 * Checks whether any of the user's assigned roles match the allowed roles.
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const hasRole = userRoles.some(r => allowedRoles.includes(r));
    if (!req.user || !hasRole) {
      return res.status(403).json({
        error: `Forbidden: You do not have permission to perform this action. Required role: one of [${allowedRoles.join(
          ", "
        )}]. Current role: ${userRoles.join(", ") || "none"}`
      });
    }
    next();
  };
}
