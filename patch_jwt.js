const fs = require('fs');

const authControllerPath = 'src/infrastructure/http/controllers/AuthController.ts';
let authController = fs.readFileSync(authControllerPath, 'utf8');

authController = authController.replace(
  /const JWT_SECRET = process\.env\.JWT_SECRET \|\| "super-secret-key";/,
  `const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required for security.");
}`
);

fs.writeFileSync(authControllerPath, authController);

const authMiddlewarePath = 'src/infrastructure/http/middleware/auth.ts';
let authMiddleware = fs.readFileSync(authMiddlewarePath, 'utf8');

authMiddleware = authMiddleware.replace(
  /const JWT_SECRET = process\.env\.JWT_SECRET \|\| "super-secret-key";/,
  `const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required for security.");
}`
);

fs.writeFileSync(authMiddlewarePath, authMiddleware);
