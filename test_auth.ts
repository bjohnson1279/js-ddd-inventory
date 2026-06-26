import { Request, Response } from "express";
import { AuthController } from "./src/infrastructure/http/controllers/AuthController";

async function main() {
  const req = {
    body: {
      tenantId: "tenant-1",
      email: "test@example.com",
      password: "password123"
    }
  } as Request;

  const res = {
    status: (code: number) => {
      console.log(`Status: ${code}`);
      return {
        json: (data: any) => console.log(`Data:`, data)
      };
    }
  } as Response;

  // Assuming Prisma is mocked or not connecting to DB, this will probably throw an error.
  await AuthController.login(req, res);
}
main();
