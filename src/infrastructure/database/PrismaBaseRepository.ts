import { prisma } from "./prisma";

export abstract class PrismaBaseRepository {
  protected readonly prisma = prisma;
}
