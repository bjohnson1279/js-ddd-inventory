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
    role: string;
    permissions?: string[];
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

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: You do not have permission to perform this action. Required role: one of [${allowedRoles.join(
          ", "
        )}]. Current role: ${req.user?.role || "none"}`
      });
    }
    next();
  };
}

export function requirePermission(resource: string, action: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.permissions) {
      return res.status(403).json({ error: "Forbidden: No permissions associated with user." });
    }
    
    const reqRes = resource.toLowerCase();
    const reqAct = action.toLowerCase();
    const required = `${reqRes}:${reqAct}`;
    
    const permissions = req.user.permissions.map(p => p.toLowerCase());
    
    const hasPermission = 
      permissions.includes(required) || 
      permissions.includes('*:*') || 
      permissions.includes(`${reqRes}:*`);
    
    if (!hasPermission && req.user.role !== "admin") {
      return res.status(403).json({
        error: `Forbidden: You do not have permission to perform this action. Required permission: ${required}.`
      });
    }
    next();
  };
}
