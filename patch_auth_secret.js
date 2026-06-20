const fs = require('fs');

const authControllerPath = 'src/infrastructure/http/controllers/AuthController.ts';
let authController = fs.readFileSync(authControllerPath, 'utf8');

authController = authController.replace(
  /const JWT_SECRET = process\.env\.JWT_SECRET \|\| "super-secret-key";/,
  `const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV !== 'test') {
  throw new Error("JWT_SECRET environment variable is required for security.");
}
const SECRET = JWT_SECRET || "test-secret"; // Only used in tests due to the check above`
);
authController = authController.replace(/JWT_SECRET,/g, 'SECRET,');

fs.writeFileSync(authControllerPath, authController);

const authMiddlewarePath = 'src/infrastructure/http/middleware/auth.ts';
let authMiddleware = fs.readFileSync(authMiddlewarePath, 'utf8');

authMiddleware = authMiddleware.replace(
  /const JWT_SECRET = process\.env\.JWT_SECRET \|\| "super-secret-key";/,
  `const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV !== 'test') {
  throw new Error("JWT_SECRET environment variable is required for security.");
}
const SECRET = JWT_SECRET || "super-secret-key"; // Only used in tests due to the check above`
);
authMiddleware = authMiddleware.replace(/JWT_SECRET\)/g, 'SECRET)');

fs.writeFileSync(authMiddlewarePath, authMiddleware);
