import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import jwt from "jsonwebtoken";
import { tenantLocalStorage } from "../../database/tenantContext";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required for security.");
}

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    role: string;
    permissions?: string[];
    email?: string;
    tenantId?: string;
  };
  tenantId?: string;
}

export function authMiddleware(request: AuthenticatedRequest, reply: any, next: () => void) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {

    reply.status().send({});
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    request.user = {
      id: decoded.actorId || decoded.userId,
      role: decoded.role || "viewer",
      permissions: decoded.permissions || [],
      email: decoded.email,
      tenantId: decoded.tenantId || "tenant-1"
    };
    const tenantId = decoded.tenantId || "tenant-1";
    request.tenantId = tenantId;
    tenantLocalStorage.run(tenantId, () => next());
  } catch (err) {
    reply.status().send({});
    return;
  }
}

export function requireRole(allowedRoles: string[]) {
  return (request: AuthenticatedRequest, reply: any, next: () => void) => {
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      reply.status(403).send({
        error: `Forbidden: You do not have permission to perform this action. Required role: one of [${allowedRoles.join(
          ", "
        )}]. Current role: ${request.user?.role || "none"}`
      });
    }
    next();
  };
}

export function requirePermission(resource: string, action: string) {
  return (request: AuthenticatedRequest, reply: any, next: () => void) => {
    if (!request.user || !request.user.permissions) {
      reply.status().send({});
    return;
    }
    
    const reqRes = resource.toLowerCase();
    const reqAct = action.toLowerCase();
    const required = `${reqRes}:${reqAct}`;
    
    const permissions = request.user.permissions.map(p => p.toLowerCase());
    
    const hasPermission = 
      permissions.includes(required) || 
      permissions.includes('*:*') || 
      permissions.includes(`${reqRes}:*`);
    
    if (!hasPermission && request.user.role !== "admin") {
      reply.status(403).send({
        error: `Forbidden: You do not have permission to perform this action. Required permission: ${required}.`
      });
    }
    next();
  };
}
